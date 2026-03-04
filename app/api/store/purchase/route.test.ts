import { POST } from "@/app/api/store/purchase/route";

describe("api store purchase", () => {
  it("purchases a packet and grants inventory", async () => {
    const res = await POST(
      new Request("http://localhost/api/store/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "packet-user",
          packetSku: "pack_undo_starter",
          quantity: 2
        })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.packetSku).toBe("pack_undo_starter");
    expect(json.quantity).toBe(2);
    expect(json.inventory?.balances?.undo_charge).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(json.grants)).toBe(true);
  });

  it("rejects unknown packet sku", async () => {
    const res = await POST(
      new Request("http://localhost/api/store/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "packet-user-bad",
          packetSku: "pack_missing"
        })
      })
    );
    expect(res.status).toBe(400);
  });
});
