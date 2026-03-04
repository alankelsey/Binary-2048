import { POST } from "@/app/api/store/webhook/route";
import { getInventory, resetInventoryStore } from "@/lib/binary2048/inventory";
import { resetStoreWebhookState } from "@/lib/binary2048/store-webhook";

describe("api store webhook", () => {
  beforeEach(() => {
    resetStoreWebhookState();
    resetInventoryStore();
  });

  afterEach(() => {
    delete process.env.BINARY2048_STORE_WEBHOOK_SECRET;
  });

  it("accepts valid secret and processes idempotent grants", async () => {
    process.env.BINARY2048_STORE_WEBHOOK_SECRET = "store-hook-secret";
    const body = {
      id: "evt_api_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_api_1",
          payment_intent: "pi_api_1",
          metadata: {
            subscriberId: "api-webhook-user",
            packetSku: "pack_undo_starter",
            quantity: "1"
          }
        }
      }
    };

    const first = await POST(
      new Request("http://localhost/api/store/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-store-webhook-secret": "store-hook-secret"
        },
        body: JSON.stringify(body)
      })
    );
    const firstJson = await first.json();
    expect(first.status).toBe(200);
    expect(firstJson.idempotent).toBe(false);

    const duplicate = await POST(
      new Request("http://localhost/api/store/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-store-webhook-secret": "store-hook-secret"
        },
        body: JSON.stringify({ ...body, id: "evt_api_2" })
      })
    );
    const dupJson = await duplicate.json();
    expect(duplicate.status).toBe(200);
    expect(dupJson.idempotent).toBe(true);
    expect(getInventory("api-webhook-user").balances.undo_charge).toBe(3);
  });

  it("rejects invalid webhook secret", async () => {
    process.env.BINARY2048_STORE_WEBHOOK_SECRET = "store-hook-secret";
    const res = await POST(
      new Request("http://localhost/api/store/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "x-store-webhook-secret": "wrong" },
        body: JSON.stringify({ id: "evt_bad", type: "checkout.session.completed" })
      })
    );
    expect(res.status).toBe(401);
  });
});

