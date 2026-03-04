import { POST as grant } from "@/app/api/store/inventory/route";
import { POST } from "@/app/api/store/consume/route";

describe("api store consume", () => {
  it("consumes granted inventory", async () => {
    await grant(
      new Request("http://localhost/api/store/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "consume-user",
          sku: "wild_boost_pack",
          quantity: 2
        })
      })
    );

    const res = await POST(
      new Request("http://localhost/api/store/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "consume-user",
          sku: "wild_boost_pack",
          quantity: 1
        })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.inventory?.balances?.wild_boost_pack).toBe(1);
    expect(json.ledgerEntry?.delta).toBe(-1);
  });

  it("returns 400 when consuming more than available", async () => {
    const res = await POST(
      new Request("http://localhost/api/store/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscriberId: "consume-none",
          sku: "lock_breaker",
          quantity: 1
        })
      })
    );
    expect(res.status).toBe(400);
  });
});
