import { getRateLimitPolicy, resolveUserTier } from "@/lib/binary2048/security-policy";

describe("security policy", () => {
  it("resolves user tiers consistently", () => {
    expect(resolveUserTier({ isAuthenticated: false, isPaid: false })).toBe("guest");
    expect(resolveUserTier({ isAuthenticated: true, isPaid: false })).toBe("authed");
    expect(resolveUserTier({ isAuthenticated: true, isPaid: true })).toBe("paid");
    expect(resolveUserTier({ isAuthenticated: false, isPaid: true })).toBe("paid");
  });

  it("returns default 5-minute limits per tier", () => {
    expect(getRateLimitPolicy("guest")).toMatchObject({
      tier: "guest",
      windowSeconds: 300,
      maxRequests: 120,
      challengeAfter: 80,
      blockAfter: 140
    });
    expect(getRateLimitPolicy("authed")).toMatchObject({
      tier: "authed",
      windowSeconds: 300,
      maxRequests: 600,
      challengeAfter: 500,
      blockAfter: 700
    });
    expect(getRateLimitPolicy("paid")).toMatchObject({
      tier: "paid",
      windowSeconds: 300,
      maxRequests: 1800,
      challengeAfter: 1600,
      blockAfter: 2000
    });
  });

  it("supports env override values with graceful fallback", () => {
    const policy = getRateLimitPolicy("guest", {
      BINARY2048_RATE_LIMIT_GUEST_5M_MAX: "240",
      BINARY2048_RATE_LIMIT_GUEST_5M_CHALLENGE: "180",
      BINARY2048_RATE_LIMIT_GUEST_5M_BLOCK: "bad-value"
    });

    expect(policy.maxRequests).toBe(240);
    expect(policy.challengeAfter).toBe(180);
    expect(policy.blockAfter).toBe(140);
  });
});
