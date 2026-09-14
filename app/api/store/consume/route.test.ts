import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { POST as grant } from "@/app/api/store/inventory/route";
import { POST } from "@/app/api/store/consume/route";
import { resetInventoryStore } from "@/lib/binary2048/inventory";
import { storeSubscriberIdForSubject } from "@/lib/binary2048/store-auth";

const subject = "consume-user@example.com";

function authHeaders() {
  const token = createAuthBridgeToken(
    { sub: subject, tier: "paid", exp: Math.floor(Date.now() / 1000) + 60 },
    process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? ""
  );
  return { authorization: `Bearer ${token}` };
}

describe("api store consume", () => {
  beforeEach(() => {
    resetInventoryStore();
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "consume-auth-secret";
    process.env.BINARY2048_ADMIN_TOKEN = "consume-admin-token";
  });

  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
    delete process.env.BINARY2048_ADMIN_TOKEN;
  });

  it("requires authentication", async () => {
    const res = await POST(new Request("http://localhost/api/store/consume", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("consumes only the authenticated account inventory", async () => {
    const subscriberId = storeSubscriberIdForSubject(subject);
    await grant(
      new Request("http://localhost/api/store/inventory", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": "consume-admin-token" },
        body: JSON.stringify({ subscriberId, sku: "wild_boost_pack", quantity: 2 })
      })
    );

    const res = await POST(
      new Request("http://localhost/api/store/consume", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          subscriberId: "attacker-selected-account",
          sku: "wild_boost_pack",
          quantity: 1
        })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.inventory?.subscriberId).toBe(subscriberId);
    expect(json.inventory?.balances?.wild_boost_pack).toBe(1);
  });
});
