import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { POST } from "@/app/api/store/purchase/route";
import { getInventory, resetInventoryStore } from "@/lib/binary2048/inventory";
import { storeSubscriberIdForSubject } from "@/lib/binary2048/store-auth";

const subject = "packet-user@example.com";

function authHeaders() {
  const token = createAuthBridgeToken(
    { sub: subject, tier: "authed", exp: Math.floor(Date.now() / 1000) + 60 },
    process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? ""
  );
  return { authorization: `Bearer ${token}` };
}

describe("api store purchase", () => {
  beforeEach(() => {
    resetInventoryStore();
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "purchase-auth-secret";
  });

  afterEach(() => {
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
    delete process.env.BINARY2048_STORE_DIRECT_PURCHASE_ENABLED;
  });

  it("requires authentication", async () => {
    const res = await POST(new Request("http://localhost/api/store/purchase", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("fails closed without verified checkout configuration", async () => {
    const res = await POST(
      new Request("http://localhost/api/store/purchase", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ packetSku: "pack_undo_starter", quantity: 2 })
      })
    );
    expect(res.status).toBe(503);
    expect(getInventory(storeSubscriberIdForSubject(subject)).balances.undo_charge).toBe(0);
  });

  it("uses the authenticated account when explicitly enabled for development", async () => {
    process.env.BINARY2048_STORE_DIRECT_PURCHASE_ENABLED = "true";
    const res = await POST(
      new Request("http://localhost/api/store/purchase", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          subscriberId: "attacker-selected-account",
          packetSku: "pack_undo_starter",
          quantity: 2
        })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.inventory?.subscriberId).toBe(storeSubscriberIdForSubject(subject));
    expect(getInventory("attacker-selected-account").balances.undo_charge).toBe(0);
  });
});
