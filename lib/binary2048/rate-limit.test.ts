import { createHash } from "crypto";
import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import {
  checkRateLimit,
  checkMoveRateLimit,
  checkSimulateRateLimit,
  checkTournamentRateLimit,
  rateLimitHeaders,
  resetRateLimitStore
} from "@/lib/binary2048/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimitStore();
    delete process.env.BINARY2048_RATE_LIMIT_TOURNAMENT_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_SIMULATE_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_MOVE_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_WINDOW_MS;
    delete process.env.BINARY2048_RATE_LIMIT_STORE;
    delete process.env.BINARY2048_MONGO_URI;
    delete process.env.BINARY2048_MONGO_RATE_LIMIT_TIMEOUT_MS;
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("uses a validated api key id for client identity", async () => {
    const rawKey = "b2048_valid-key";
    process.env.BINARY2048_BOT_API_KEY_HASHES = `bot-alpha=${createHash("sha256").update(rawKey).digest("hex")}`;
    const req = new Request("http://localhost", { headers: { "x-api-key": rawKey } });
    const first = await checkRateLimit({ req, route: "x", max: 1, windowMs: 10000 });
    const second = await checkRateLimit({ req, route: "x", max: 1, windowMs: 10000 });
    expect(first.allowed).toBe(true);
    expect(first.key).toBe("x:key:bot-alpha");
    expect(second.allowed).toBe(false);
  });

  it("prevents arbitrary key rotation by sharing the ip fallback bucket", async () => {
    const first = await checkRateLimit({
      req: new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.9", "x-api-key": "fake-one" } }),
      route: "x", max: 1, windowMs: 10000
    });
    const second = await checkRateLimit({
      req: new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.9", "x-api-key": "fake-two" } }),
      route: "x", max: 1, windowMs: 10000
    });
    expect(first.key).toBe("x:ip:10.1.1.9");
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });

  it("formats quota headers and adds Retry-After only when blocked", async () => {
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.12" } });
    const allowed = await checkRateLimit({ req, route: "headers", max: 1, windowMs: 10000 });
    const blocked = await checkRateLimit({ req, route: "headers", max: 1, windowMs: 10000 });
    expect(rateLimitHeaders(allowed)).toMatchObject({ "RateLimit-Limit": "1", "RateLimit-Remaining": "0" });
    expect(rateLimitHeaders(allowed)["Retry-After"]).toBeUndefined();
    expect(rateLimitHeaders(blocked)["Retry-After"]).toMatch(/^\d+$/);
  });

  it("uses endpoint-specific env limits", async () => {
    process.env.BINARY2048_RATE_LIMIT_TOURNAMENT_MAX = "1";
    process.env.BINARY2048_RATE_LIMIT_SIMULATE_MAX = "2";
    process.env.BINARY2048_RATE_LIMIT_WINDOW_MS = "120000";

    const tReq = new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.1" } });
    const sReq = new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.1" } });

    expect((await checkTournamentRateLimit(tReq)).allowed).toBe(true);
    expect((await checkTournamentRateLimit(tReq)).allowed).toBe(false);

    expect((await checkSimulateRateLimit(sReq)).allowed).toBe(true);
    expect((await checkSimulateRateLimit(sReq)).allowed).toBe(true);
    expect((await checkSimulateRateLimit(sReq)).allowed).toBe(false);
  });

  it("keeps gameplay moves on a separate higher default quota", async () => {
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.20" } });
    const move = await checkMoveRateLimit(req);
    const simulate = await checkSimulateRateLimit(req);
    expect(move.limit).toBe(120);
    expect(simulate.limit).toBe(60);
    expect(move.key).toContain("game_move:");
    expect(simulate.key).toContain("simulate:");
  });

  it("uses a privacy-safe account bucket and authenticated tier quota", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "account-rate-limit-secret";
    const token = createAuthBridgeToken(
      { sub: "player@example.com", exp: Math.floor(Date.now() / 1000) + 300, tier: "authed" },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET
    );
    const req = new Request("http://localhost", {
      headers: { authorization: `Bearer ${token}`, "x-forwarded-for": "10.1.1.22" }
    });

    const move = await checkMoveRateLimit(req);

    expect(move.limit).toBe(600);
    expect(move.scope).toBe("account");
    expect(move.tier).toBe("authed");
    expect(move.key).toMatch(/^game_move:account:[a-f0-9]{64}$/);
    expect(move.key).not.toContain("player@example.com");
    expect(rateLimitHeaders(move)).toMatchObject({
      "RateLimit-Scope": "account",
      "RateLimit-Tier": "authed",
      "RateLimit-Limit": "600"
    });
  });

  it("gives paid accounts the paid gameplay quota", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "paid-rate-limit-secret";
    const token = createAuthBridgeToken(
      { sub: "paid-player", exp: Math.floor(Date.now() / 1000) + 300, tier: "paid" },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET
    );

    const move = await checkMoveRateLimit(
      new Request("http://localhost", { headers: { authorization: `Bearer ${token}` } })
    );

    expect(move.limit).toBe(1800);
    expect(move.scope).toBe("account");
    expect(move.tier).toBe("paid");
  });

  it("keeps browser move quotas in memory when shared Mongo counters are enabled", async () => {
    process.env.BINARY2048_RATE_LIMIT_STORE = "mongo";
    process.env.BINARY2048_MONGO_URI = "mongodb://127.0.0.1:1";
    process.env.BINARY2048_MONGO_RATE_LIMIT_TIMEOUT_MS = "1";
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.21" } });

    const move = await checkMoveRateLimit(req);

    expect(move.backend).toBe("memory");
    expect(move.key).toBe("game_move:ip:10.1.1.21");
  });

  it("retains shared Mongo enforcement for verified bot move keys", async () => {
    const rawKey = "b2048_move-bot";
    process.env.BINARY2048_BOT_API_KEY_HASHES = `bot-move=${createHash("sha256").update(rawKey).digest("hex")}`;
    process.env.BINARY2048_RATE_LIMIT_STORE = "mongo";
    process.env.BINARY2048_MONGO_URI = "mongodb://127.0.0.1:1";
    process.env.BINARY2048_MONGO_RATE_LIMIT_TIMEOUT_MS = "1";
    const req = new Request("http://localhost", { headers: { "x-api-key": rawKey } });

    const move = await checkMoveRateLimit(req);

    expect(move.backend).toBe("memory_fallback");
    expect(move.key).toBe("game_move:key:bot-move");
  });
});
