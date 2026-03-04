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

type ProcessedGrantResult = ReturnType<typeof executePacketPurchase>;

const globalStore = globalThis as typeof globalThis & {
  __binary2048_processed_webhook_events?: Set<string>;
  __binary2048_processed_webhook_payments?: Map<string, ProcessedGrantResult>;
};

const processedEvents = globalStore.__binary2048_processed_webhook_events ?? new Set<string>();
const processedPayments = globalStore.__binary2048_processed_webhook_payments ?? new Map<string, ProcessedGrantResult>();
globalStore.__binary2048_processed_webhook_events = processedEvents;
globalStore.__binary2048_processed_webhook_payments = processedPayments;

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

export function processStoreWebhookEvent(payload: unknown) {
  const event = parseEvent(payload);
  const object = event.data?.object;
  const paymentRef = object?.payment_intent || object?.id || event.id;

  if (processedEvents.has(event.id)) {
    return {
      acknowledged: true as const,
      idempotent: true as const,
      alreadyProcessed: true as const,
      eventId: event.id,
      paymentRef
    };
  }

  const grantsOnTypes = new Set(["checkout.session.completed", "payment_intent.succeeded"]);
  if (!grantsOnTypes.has(event.type)) {
    processedEvents.add(event.id);
    return {
      acknowledged: true as const,
      idempotent: true as const,
      skipped: true as const,
      eventId: event.id,
      paymentRef
    };
  }

  const existing = processedPayments.get(paymentRef);
  if (existing) {
    processedEvents.add(event.id);
    return {
      acknowledged: true as const,
      idempotent: true as const,
      alreadyProcessed: true as const,
      eventId: event.id,
      paymentRef,
      purchase: existing
    };
  }

  const metadata = object?.metadata;
  if (!metadata?.subscriberId) throw new Error("Webhook metadata.subscriberId is required");
  if (!metadata?.packetSku) throw new Error("Webhook metadata.packetSku is required");

  const purchase = executePacketPurchase({
    subscriberId: metadata.subscriberId,
    packetSku: metadata.packetSku,
    quantity: parsePositiveInt(metadata.quantity),
    grantReason: "grant"
  });
  processedEvents.add(event.id);
  processedPayments.set(paymentRef, purchase);

  return {
    acknowledged: true as const,
    idempotent: false as const,
    eventId: event.id,
    paymentRef,
    purchase
  };
}

export function resetStoreWebhookState() {
  processedEvents.clear();
  processedPayments.clear();
}

