import { POST } from "@/app/api/auth/dev-token/route";
import { verifyAuthBridgeToken } from "@/lib/binary2048/auth-bridge";

describe("POST /api/auth/dev-token", () => {
  const authSecret = "dev-auth-secret";

  afterEach(() => {
    delete process.env.BINARY2048_ENABLE_DEV_AUTH_TOKEN;
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("returns 404 when endpoint is disabled", async () => {
    const res = await POST(new Request("http://localhost/api/auth/dev-token", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("returns 503 when auth secret is missing", async () => {
    process.env.BINARY2048_ENABLE_DEV_AUTH_TOKEN = "1";
    const res = await POST(new Request("http://localhost/api/auth/dev-token", { method: "POST" }));
    expect(res.status).toBe(503);
  });

  it("mints a valid auth-bridge token for paid tier", async () => {
    process.env.BINARY2048_ENABLE_DEV_AUTH_TOKEN = "1";
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = authSecret;

    const res = await POST(
      new Request("http://localhost/api/auth/dev-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sub: "dev-paid",
          tier: "paid",
          entitlements: ["extra_undos"],
          ttlSeconds: 120
        })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(typeof json.token).toBe("string");
    expect(json.userTier).toBe("paid");

    const claims = verifyAuthBridgeToken(json.token, authSecret);
    expect(claims?.sub).toBe("dev-paid");
    expect(claims?.tier).toBe("paid");
    expect(claims?.entitlements).toContain("extra_undos");
  });
});
