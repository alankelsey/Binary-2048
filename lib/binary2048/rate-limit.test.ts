import {
  checkRateLimit,
  checkSimulateRateLimit,
  checkTournamentRateLimit,
  resetRateLimitStore
} from "@/lib/binary2048/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimitStore();
    delete process.env.BINARY2048_RATE_LIMIT_TOURNAMENT_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_SIMULATE_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_WINDOW_MS;
  });

  it("uses api key when present for client identity", () => {
    const req = new Request("http://localhost", { headers: { "x-api-key": "abc" } });
    const first = checkRateLimit({ req, route: "x", max: 1, windowMs: 10000 });
    const second = checkRateLimit({ req, route: "x", max: 1, windowMs: 10000 });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });

  it("uses endpoint-specific env limits", () => {
    process.env.BINARY2048_RATE_LIMIT_TOURNAMENT_MAX = "1";
    process.env.BINARY2048_RATE_LIMIT_SIMULATE_MAX = "2";
    process.env.BINARY2048_RATE_LIMIT_WINDOW_MS = "120000";

    const tReq = new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.1" } });
    const sReq = new Request("http://localhost", { headers: { "x-forwarded-for": "10.1.1.1" } });

    expect(checkTournamentRateLimit(tReq).allowed).toBe(true);
    expect(checkTournamentRateLimit(tReq).allowed).toBe(false);

    expect(checkSimulateRateLimit(sReq).allowed).toBe(true);
    expect(checkSimulateRateLimit(sReq).allowed).toBe(true);
    expect(checkSimulateRateLimit(sReq).allowed).toBe(false);
  });
});

