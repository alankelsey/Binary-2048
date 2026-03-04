import { createHmac } from "crypto";
import { POST } from "@/app/api/auth/entitlements/proof/route";
import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { LOCK_RANKED_ENTITLEMENT } from "@/lib/binary2048/lock-economy";
import { verifyEntitlementProof } from "@/lib/binary2048/entitlement-proof";

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signHeaderClaims(encodedClaims: string, secret: string) {
  return createHmac("sha256", secret)
    .update(encodedClaims)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("POST /api/auth/entitlements/proof", () => {
  const authSecret = "auth-bridge-secret";
  const proofSecret = "ent-proof-secret";

  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
    delete process.env.BINARY2048_AUTH_HEADER_SECRET;
    delete process.env.BINARY2048_ENTITLEMENT_SECRET;
    delete process.env.BINARY2048_ENTITLEMENT_PROOF_TTL_SECONDS;
  });

  it("mints proof for paid user and includes ranked lock entitlement", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = authSecret;
    process.env.BINARY2048_ENTITLEMENT_SECRET = proofSecret;
    const token = createAuthBridgeToken(
      {
        sub: "u_paid",
        exp: Math.floor(Date.now() / 1000) + 60,
        tier: "paid",
        entitlements: ["extra_undos"]
      },
      authSecret
    );

    const res = await POST(
      new Request("http://localhost/api/auth/entitlements/proof", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sessionClass: "ranked" })
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.userTier).toBe("paid");
    expect(json.entitlements).toContain(LOCK_RANKED_ENTITLEMENT);
    const verified = verifyEntitlementProof(json.proof, proofSecret);
    expect(verified).toContain(LOCK_RANKED_ENTITLEMENT);
    expect(verified).toContain("extra_undos");
  });

  it("rejects invalid token", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = authSecret;
    process.env.BINARY2048_ENTITLEMENT_SECRET = proofSecret;
    const res = await POST(
      new Request("http://localhost/api/auth/entitlements/proof", {
        method: "POST",
        headers: {
          authorization: "Bearer bad.token"
        }
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects guest-tier token", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = authSecret;
    process.env.BINARY2048_ENTITLEMENT_SECRET = proofSecret;
    const token = createAuthBridgeToken(
      {
        sub: "u_guest",
        exp: Math.floor(Date.now() / 1000) + 60,
        tier: "guest"
      },
      authSecret
    );

    const res = await POST(
      new Request("http://localhost/api/auth/entitlements/proof", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`
        }
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 503 when secrets are not configured", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/entitlements/proof", {
        method: "POST"
      })
    );
    expect(res.status).toBe(503);
  });

  it("mints proof from signed auth header claims", async () => {
    process.env.BINARY2048_AUTH_HEADER_SECRET = "header-secret";
    process.env.BINARY2048_ENTITLEMENT_SECRET = proofSecret;
    const encodedClaims = toBase64Url(
      JSON.stringify({
        sub: "u_header",
        exp: Math.floor(Date.now() / 1000) + 60,
        tier: "paid",
        entitlements: ["extra_undos"]
      })
    );
    const sig = signHeaderClaims(encodedClaims, process.env.BINARY2048_AUTH_HEADER_SECRET);

    const res = await POST(
      new Request("http://localhost/api/auth/entitlements/proof", {
        method: "POST",
        headers: {
          "x-binary2048-auth-claims": encodedClaims,
          "x-binary2048-auth-sig": sig
        }
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.userTier).toBe("paid");
    expect(json.entitlements).toContain(LOCK_RANKED_ENTITLEMENT);
  });
});
