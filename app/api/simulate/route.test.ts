import { createHash } from "crypto";
import { POST } from "@/app/api/simulate/route";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";

describe("POST /api/simulate", () => {
  beforeEach(() => {
    resetRateLimitStore();
    delete process.env.BINARY2048_RATE_LIMIT_SIMULATE_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_WINDOW_MS;
    delete process.env.BINARY2048_CHALLENGE_MODE;
    delete process.env.BINARY2048_CHALLENGE_SECRET;
    delete process.env.BINARY2048_DEGRADE_MODE;
    delete process.env.BINARY2048_DEGRADE_DISABLE_SIMULATE;
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
  });

  it("accepts compact actions and returns final artifacts", async () => {
    const req = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 77,
        moves: ["L", "U", "R"],
        config: { size: 4 }
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.rulesetId).toBe("binary2048-v1");
    expect(typeof json.totalScore).toBe("number");
    expect(typeof json.finalStateHash).toBe("string");
    expect(Array.isArray(json.finalEncodedFlat)).toBe(true);
    expect(json.finalEncodedFlat.length).toBe(4 * 4 * 2);
    expect(Array.isArray(json.finalActionMask)).toBe(true);
    expect(json.finalActionMask).toHaveLength(4);
    expect(res.headers.get("ratelimit-limit")).toBe("60");
    expect(res.headers.get("ratelimit-remaining")).toBe("59");
    expect(res.headers.get("ratelimit-reset")).toMatch(/^\d+$/);
  });

  it("returns 400 for invalid direction token", async () => {
    const req = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 88,
        moves: ["LEFT"],
        config: { size: 4 }
      })
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(typeof json.error).toBe("string");
  });

  it("returns 429 when simulate rate limit is exceeded for same api key", async () => {
    process.env.BINARY2048_RATE_LIMIT_SIMULATE_MAX = "1";
    process.env.BINARY2048_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.BINARY2048_BOT_API_KEY_HASHES = `sim-bot=${createHash("sha256").update("sim-key-1").digest("hex")}`;

    const req1 = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "sim-key-1" },
      body: JSON.stringify({
        seed: 42,
        moves: ["L"],
        config: { size: 4 }
      })
    });
    const req2 = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "sim-key-1" },
      body: JSON.stringify({
        seed: 43,
        moves: ["R"],
        config: { size: 4 }
      })
    });

    const first = await POST(req1);
    const second = await POST(req2);
    const secondJson = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(secondJson.error).toBe("Rate limit exceeded");
    expect(secondJson.route).toBe("simulate");
    expect(second.headers.get("ratelimit-limit")).toBe("1");
    expect(second.headers.get("ratelimit-remaining")).toBe("0");
    expect(second.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("returns 403 when challenge is enforced and token is missing", async () => {
    process.env.BINARY2048_CHALLENGE_MODE = "enforce";
    process.env.BINARY2048_CHALLENGE_SECRET = "challenge-secret";
    const req = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 77,
        moves: ["L"],
        config: { size: 4 }
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe("Challenge required");
  });

  it("returns 400 when moves exceed endpoint cap", async () => {
    const req = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 77,
        moves: Array.from({ length: 2001 }, () => "L"),
        config: { size: 4 }
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.code).toBe("cost_cap_exceeded");
    expect(json.field).toBe("moves");
    expect(json.limit).toBe(2000);
  });

  it("returns 503 when degrade mode disables simulate endpoint", async () => {
    process.env.BINARY2048_DEGRADE_DISABLE_SIMULATE = "1";
    const req = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 77,
        moves: ["L"],
        config: { size: 4 }
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.code).toBe("degrade_mode");
    expect(json.route).toBe("simulate");
  });

  it("returns 413 for oversized payload", async () => {
    const hugeMoves = Array.from({ length: 80_000 }, () => "L");
    const req = new Request("http://localhost/api/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 77,
        moves: hugeMoves,
        config: { size: 4 }
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(413);
    expect(json.error).toBe("Request body too large");
  });
});
