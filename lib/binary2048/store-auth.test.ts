import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { getStorePrincipal, storeSubscriberIdForSubject } from "@/lib/binary2048/store-auth";

describe("store authentication", () => {
  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("derives a stable, non-identifying subscriber id", () => {
    const first = storeSubscriberIdForSubject("player@example.com");
    expect(first).toMatch(/^acct_[a-f0-9]{64}$/);
    expect(first).toBe(storeSubscriberIdForSubject("player@example.com"));
    expect(first).not.toContain("player@example.com");
  });

  it("resolves the store principal only from a verified bearer token", () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "store-principal-secret";
    const token = createAuthBridgeToken(
      {
        sub: "paid@example.com",
        tier: "paid",
        entitlements: ["lock_tiles_ranked"],
        exp: Math.floor(Date.now() / 1000) + 60
      },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET
    );
    const principal = getStorePrincipal(
      new Request("http://localhost", { headers: { authorization: `Bearer ${token}` } })
    );

    expect(principal).toEqual({
      subscriberId: storeSubscriberIdForSubject("paid@example.com"),
      tier: "paid",
      entitlements: ["lock_tiles_ranked"]
    });
    expect(getStorePrincipal(new Request("http://localhost"))).toBeNull();
  });
});
