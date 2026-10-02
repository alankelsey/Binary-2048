import { getInventory, resetInventoryStore } from "@/lib/binary2048/inventory";
import { processStoreWebhookEvent, resetStoreWebhookState } from "@/lib/binary2048/store-webhook";

describe("store-webhook processor", () => {
  beforeEach(() => {
    resetStoreWebhookState();
    resetInventoryStore();
  });

  it("grants packet purchase only once for duplicate webhook events", async () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_intent: "pi_1",
          metadata: {
            subscriberId: "webhook-user",
            packetSku: "pack_undo_starter",
            quantity: "2"
          }
        }
      }
    };

    const first = (await processStoreWebhookEvent(event));
    const second = (await processStoreWebhookEvent(event));
    const inventory = (await getInventory("webhook-user"));

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(inventory.balances.undo_charge).toBe(6);
  });

  it("prevents double-grant across different event ids with same payment ref", async () => {
    const base = {
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_2",
          payment_intent: "pi_2",
          metadata: {
            subscriberId: "webhook-user-2",
            packetSku: "pack_undo_starter",
            quantity: 1
          }
        }
      }
    };

    const first = (await processStoreWebhookEvent({ id: "evt_2", ...base }));
    const second = (await processStoreWebhookEvent({ id: "evt_3", ...base }));
    const inventory = (await getInventory("webhook-user-2"));

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(inventory.balances.undo_charge).toBe(3);
  });
});

