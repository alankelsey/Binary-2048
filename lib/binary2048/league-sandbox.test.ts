import {
  resetSandboxRateLimitForTests,
  resolveSandboxSubmissionMode,
  verifySandboxSubmissionAccess
} from "@/lib/binary2048/league-sandbox";

describe("league sandbox policy", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetSandboxRateLimitForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("resolves preview submissions into sandbox namespace", () => {
    const mode = resolveSandboxSubmissionMode({ seasonMode: "preview" });
    expect(mode.namespace).toBe("sandbox");
    expect(mode.isSandbox).toBe(true);
    expect(mode.seasonMode).toBe("preview");
  });

  it("supports global shadow-write toggle", () => {
    process.env.BINARY2048_LEAGUE_SHADOW_WRITE = "true";
    const mode = resolveSandboxSubmissionMode({});
    expect(mode.namespace).toBe("sandbox");
    expect(mode.shadowWrite).toBe(true);
  });

  it("enforces sandbox API key when configured", () => {
    process.env.BINARY2048_SANDBOX_API_KEYS = "k1,k2";
    const req = new Request("http://localhost/api/leaderboard/submit");
    const denied = verifySandboxSubmissionAccess(req, { isSandbox: true });
    expect(denied.ok).toBe(false);
    expect(denied.status).toBe(401);

    const okReq = new Request("http://localhost/api/leaderboard/submit", {
      headers: { "x-league-client-key": "k1" }
    });
    const allowed = verifySandboxSubmissionAccess(okReq, { isSandbox: true });
    expect(allowed.ok).toBe(true);
  });

  it("applies sandbox key rate limiting", () => {
    process.env.BINARY2048_SANDBOX_API_KEYS = "k1";
    process.env.BINARY2048_SANDBOX_RATE_LIMIT_PER_5M = "2";
    const req = () =>
      new Request("http://localhost/api/leaderboard/submit", {
        headers: {
          "x-league-client-key": "k1",
          "x-forwarded-for": "10.0.0.1"
        }
      });
    expect(verifySandboxSubmissionAccess(req(), { isSandbox: true }).ok).toBe(true);
    expect(verifySandboxSubmissionAccess(req(), { isSandbox: true }).ok).toBe(true);
    const blocked = verifySandboxSubmissionAccess(req(), { isSandbox: true });
    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe(429);
  });
});

