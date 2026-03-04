import { GET, POST } from "@/app/api/store/inventory/route";

describe("api store inventory", () => {
  it("requires subscriberId on GET", async () => {
    const res = await GET(new Request("http://localhost/api/store/inventory"));
    expect(res.status).toBe(400);
  });

  it("grants inventory and returns balances + ledger", async () => {
    const grantRes = await POST(
      new Request("http://localhost/api/store/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "store-user",
          sku: "undo_charge",
          quantity: 5
        })
      })
    );
    const grantJson = await grantRes.json();
    expect(grantRes.status).toBe(200);
    expect(grantJson.inventory?.balances?.undo_charge).toBe(5);

    const listRes = await GET(new Request("http://localhost/api/store/inventory?subscriberId=store-user"));
    const listJson = await listRes.json();
    expect(listRes.status).toBe(200);
    expect(listJson.inventory?.balances?.undo_charge).toBe(5);
    expect(Array.isArray(listJson.ledger)).toBe(true);
  });
});
