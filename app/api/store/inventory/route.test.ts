import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { GET, POST } from "@/app/api/store/inventory/route";
import { resetInventoryStore } from "@/lib/binary2048/inventory";
import { storeSubscriberIdForSubject } from "@/lib/binary2048/store-auth";

const subject = "store-user@example.com";

function authHeaders() {
  const token = createAuthBridgeToken(
    { sub: subject, tier: "authed", exp: Math.floor(Date.now() / 1000) + 60 },
    process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? ""
  );
  return { authorization: `Bearer ${token}` };
}

describe("api store inventory", () => {
  beforeEach(() => {
    resetInventoryStore();
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "store-auth-secret";
    process.env.BINARY2048_ADMIN_TOKEN = "store-admin-token";
  });

  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
    delete process.env.BINARY2048_ADMIN_TOKEN;
  });

  it("requires authentication and denies another subscriber id", async () => {
    expect((await GET(new Request("http://localhost/api/store/inventory"))).status).toBe(401);
    const denied = await GET(
      new Request("http://localhost/api/store/inventory?subscriberId=someone-else", {
        headers: authHeaders()
      })
    );
    expect(denied.status).toBe(403);
  });

  it("uses the authenticated account hash for balances and ledger", async () => {
    const subscriberId = storeSubscriberIdForSubject(subject);
    const grantRes = await POST(
      new Request("http://localhost/api/store/inventory", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": "store-admin-token" },
        body: JSON.stringify({ subscriberId, sku: "undo_charge", quantity: 5 })
      })
    );
    expect(grantRes.status).toBe(200);

    const listRes = await GET(
      new Request("http://localhost/api/store/inventory", { headers: authHeaders() })
    );
    const listJson = await listRes.json();
    expect(listRes.status).toBe(200);
    expect(listJson.inventory?.subscriberId).toBe(subscriberId);
    expect(listJson.inventory?.subscriberId).not.toContain(subject);
    expect(listJson.inventory?.balances?.undo_charge).toBe(5);
    expect(listJson.userTier).toBe("authed");
    expect(Array.isArray(listJson.ledger)).toBe(true);
  });

  it("requires an admin token for grants", async () => {
    const res = await POST(
      new Request("http://localhost/api/store/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriberId: "store-user", sku: "undo_charge", quantity: 5 })
      })
    );
    expect(res.status).toBe(401);
  });
});
