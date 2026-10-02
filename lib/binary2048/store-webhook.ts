import { executePacketPurchase } from "@/lib/binary2048/store-purchase";

type WebhookEvent = {
  id: string;
  type: string;
  data?: {
    object?: {
      id?: string;
      payment_intent?: string;
      metadata?: {
        subscriberId?: string;
        packetSku?: string;
        quantity?: string | number;
      };
    };
  };
};

function parseEvent(payload: unknown): WebhookEvent {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid webhook event payload");
  }
  const event = payload as WebhookEvent;
  if (!event.id || typeof event.id !== "string") throw new Error("Webhook event id is required");
  if (!event.type || typeof event.type !== "string") throw new Error("Webhook event type is required");
  return event;
}

function parsePositiveInt(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

export async function processStoreWebhookEvent(payload: unknown) {
  const event = parseEvent(payload);
  const object = event.data?.object;
  const paymentRef = object?.payment_intent || object?.id || event.id;

  const grantsOnTypes = new Set(["checkout.session.completed", "payment_intent.succeeded"]);
  if (!grantsOnTypes.has(event.type)) return { acknowledged: true, idempotent: true, skipped: true, eventId: event.id, paymentRef };

  const metadata = object?.metadata;
  if (!metadata?.subscriberId) throw new Error("Webhook metadata.subscriberId is required");
  if (!metadata?.packetSku) throw new Error("Webhook metadata.packetSku is required");

  const purchase = (await executePacketPurchase({
    subscriberId: metadata.subscriberId,
    packetSku: metadata.packetSku,
    quantity: parsePositiveInt(metadata.quantity),
    grantReason: "grant",
    paymentRef
  }));

  return {
    acknowledged: true as const,
    idempotent: purchase.alreadyProcessed,
    alreadyProcessed: purchase.alreadyProcessed,
    eventId: event.id,
    paymentRef,
    purchase
  };
}

export function resetStoreWebhookState() {
  // Receipt state belongs to the inventory store and resets with that store.
}

