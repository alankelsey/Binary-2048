import { createAuthBridgeToken, verifyAuthBridgeToken } from "@/lib/binary2048/auth-bridge";

describe("auth bridge token", () => {
  const secret = "auth-bridge-secret";

  it("verifies a valid token and normalizes claims", () => {
    const token = createAuthBridgeToken(
      {
        sub: "u_123",
        exp: Math.floor(Date.now() / 1000) + 120,
        tier: "paid",
        entitlements: ["lock_tiles_ranked"]
      },
      secret
    );
    const claims = verifyAuthBridgeToken(token, secret);
    expect(claims?.sub).toBe("u_123");
    expect(claims?.tier).toBe("paid");
    expect(claims?.entitlements).toEqual(["lock_tiles_ranked"]);
  });

  it("rejects tampered signatures", () => {
    const token = createAuthBridgeToken(
      {
        sub: "u_123",
        exp: Math.floor(Date.now() / 1000) + 120,
        tier: "authed"
      },
      secret
    );
    expect(verifyAuthBridgeToken(`${token}x`, secret)).toBeNull();
  });

  it("rejects expired token", () => {
    const token = createAuthBridgeToken(
      {
        sub: "u_123",
        exp: Math.floor(Date.now() / 1000) - 1,
        tier: "authed"
      },
      secret
    );
    expect(verifyAuthBridgeToken(token, secret)).toBeNull();
  });
});
