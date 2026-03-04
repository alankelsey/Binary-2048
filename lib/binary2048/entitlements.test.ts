import { deriveEntitlementsForTier } from "@/lib/binary2048/entitlements";
import { LOCK_RANKED_ENTITLEMENT } from "@/lib/binary2048/lock-economy";

describe("deriveEntitlementsForTier", () => {
  it("adds ranked lock entitlement for paid users", () => {
    const entitlements = deriveEntitlementsForTier("paid", ["extra_undos"]);
    expect(entitlements).toContain("extra_undos");
    expect(entitlements).toContain(LOCK_RANKED_ENTITLEMENT);
  });

  it("does not add ranked lock entitlement for guest/authed by default", () => {
    expect(deriveEntitlementsForTier("guest", [])).toEqual([]);
    expect(deriveEntitlementsForTier("authed", ["custom"])).toEqual(["custom"]);
  });
});
