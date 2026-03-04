import { createHmac } from "crypto";
import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signHeaderClaims(encoded: string, secret: string) {
  return createHmac("sha256", secret)
    .update(encoded)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("auth context", () => {
  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
    delete process.env.BINARY2048_AUTH_HEADER_SECRET;
  });

  it("verifies bearer auth-bridge token", () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "bridge-secret";
    const token = createAuthBridgeToken(
      {
        sub: "u_bearer",
        exp: Math.floor(Date.now() / 1000) + 60,
        tier: "paid",
        entitlements: ["extra_undos"]
      },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET
    );

    const req = new Request("http://localhost", {
      headers: { authorization: `Bearer ${token}` }
    });
    const claims = getVerifiedAuthClaims(req);
    expect(claims?.sub).toBe("u_bearer");
    expect(claims?.tier).toBe("paid");
  });

  it("falls back to signed header claims", () => {
    process.env.BINARY2048_AUTH_HEADER_SECRET = "header-secret";
    const claimsPayload = toBase64Url(
      JSON.stringify({
        sub: "u_header",
        exp: Math.floor(Date.now() / 1000) + 60,
        tier: "authed",
        entitlements: ["extra_undos"]
      })
    );
    const sig = signHeaderClaims(claimsPayload, process.env.BINARY2048_AUTH_HEADER_SECRET);
    const req = new Request("http://localhost", {
      headers: {
        "x-binary2048-auth-claims": claimsPayload,
        "x-binary2048-auth-sig": sig
      }
    });

    const claims = getVerifiedAuthClaims(req);
    expect(claims?.sub).toBe("u_header");
    expect(claims?.tier).toBe("authed");
    expect(claims?.entitlements).toContain("extra_undos");
  });
});
