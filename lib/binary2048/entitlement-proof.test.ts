import { createEntitlementProof, verifyEntitlementProof } from "@/lib/binary2048/entitlement-proof";

describe("entitlement proof", () => {
  const secret = "test-secret";

  it("verifies valid signed proof", () => {
    const proof = createEntitlementProof(
      {
        entitlements: ["lock_tiles_ranked"],
        exp: Math.floor(Date.now() / 1000) + 60
      },
      secret
    );
    const entitlements = verifyEntitlementProof(proof, secret);
    expect(entitlements).toEqual(["lock_tiles_ranked"]);
  });

  it("rejects tampered signature", () => {
    const proof = createEntitlementProof(
      {
        entitlements: ["lock_tiles_ranked"],
        exp: Math.floor(Date.now() / 1000) + 60
      },
      secret
    );
    const tampered = `${proof}x`;
    expect(verifyEntitlementProof(tampered, secret)).toEqual([]);
  });

  it("rejects expired proof", () => {
    const proof = createEntitlementProof(
      {
        entitlements: ["lock_tiles_ranked"],
        exp: Math.floor(Date.now() / 1000) - 10
      },
      secret
    );
    expect(verifyEntitlementProof(proof, secret)).toEqual([]);
  });
});
