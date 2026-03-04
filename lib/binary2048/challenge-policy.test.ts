import { evaluateChallenge } from "@/lib/binary2048/challenge-policy";

describe("challenge-policy", () => {
  afterEach(() => {
    delete process.env.BINARY2048_CHALLENGE_MODE;
    delete process.env.BINARY2048_CHALLENGE_SECRET;
  });

  it("allows when mode is off", () => {
    process.env.BINARY2048_CHALLENGE_MODE = "off";
    const req = new Request("http://localhost");
    const result = evaluateChallenge({ req, route: "/api/simulate", risk: "high", userTier: "guest" });
    expect(result.allowed).toBe(true);
  });

  it("blocks when challenge is required and missing in enforce mode", () => {
    process.env.BINARY2048_CHALLENGE_MODE = "enforce";
    process.env.BINARY2048_CHALLENGE_SECRET = "challenge-secret";
    const req = new Request("http://localhost");
    const result = evaluateChallenge({ req, route: "/api/simulate", risk: "high", userTier: "guest" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("challenge");
  });

  it("allows when valid challenge header is supplied", () => {
    process.env.BINARY2048_CHALLENGE_MODE = "enforce";
    process.env.BINARY2048_CHALLENGE_SECRET = "challenge-secret";
    const req = new Request("http://localhost", {
      headers: { "x-binary2048-challenge-token": "challenge-secret" }
    });
    const result = evaluateChallenge({ req, route: "/api/simulate", risk: "high", userTier: "guest" });
    expect(result.allowed).toBe(true);
  });
});

