export type SubscriptionTopic = "app_updates" | "player_actions" | "leaderboard_actions";
export type SubscriptionTransport = "email" | "webhook" | "inapp";

export type SubscriptionRecord = {
  id: string;
  subscriberId: string;
  transport: SubscriptionTransport;
  endpoint: string;
  topics: SubscriptionTopic[];
  enabled: boolean;
  createdAtISO: string;
  updatedAtISO: string;
};

type SubscriptionStore = Map<string, SubscriptionRecord>;

const globalStore = globalThis as typeof globalThis & {
  __binary2048_subscriptions?: SubscriptionStore;
};

const subscriptions = globalStore.__binary2048_subscriptions ?? new Map<string, SubscriptionRecord>();
globalStore.__binary2048_subscriptions = subscriptions;

const TOPIC_SET = new Set<SubscriptionTopic>(["app_updates", "player_actions", "leaderboard_actions"]);
const TRANSPORT_SET = new Set<SubscriptionTransport>(["email", "webhook", "inapp"]);

let idCounter = 1;

function nowISO() {
  return new Date().toISOString();
}

function isTopic(value: unknown): value is SubscriptionTopic {
  return typeof value === "string" && TOPIC_SET.has(value as SubscriptionTopic);
}

function isTransport(value: unknown): value is SubscriptionTransport {
  return typeof value === "string" && TRANSPORT_SET.has(value as SubscriptionTransport);
}

export function normalizeTopics(value: unknown): SubscriptionTopic[] {
  if (!Array.isArray(value)) return [];
  const topics = value.filter(isTopic);
  return Array.from(new Set(topics));
}

export function listSubscriptions(subscriberId: string): SubscriptionRecord[] {
  return Array.from(subscriptions.values()).filter((record) => record.subscriberId === subscriberId);
}

export function upsertSubscription(input: {
  subscriberId: unknown;
  transport: unknown;
  endpoint: unknown;
  topics: unknown;
  enabled?: unknown;
}): SubscriptionRecord {
  if (typeof input.subscriberId !== "string" || input.subscriberId.trim().length < 2) {
    throw new Error("subscriberId is required");
  }
  if (!isTransport(input.transport)) throw new Error("transport must be one of: email, webhook, inapp");
  if (typeof input.endpoint !== "string" || input.endpoint.trim().length < 3) {
    throw new Error("endpoint is required");
  }
  const topics = normalizeTopics(input.topics);
  if (topics.length === 0) throw new Error("topics must include at least one valid topic");

  const subscriberId = input.subscriberId.trim();
  const transport = input.transport;
  const endpoint = input.endpoint.trim();
  const enabled = typeof input.enabled === "boolean" ? input.enabled : true;

  const existing = Array.from(subscriptions.values()).find(
    (record) =>
      record.subscriberId === subscriberId && record.transport === transport && record.endpoint === endpoint
  );
  const timestamp = nowISO();

  if (existing) {
    const next: SubscriptionRecord = {
      ...existing,
      topics,
      enabled,
      updatedAtISO: timestamp
    };
    subscriptions.set(existing.id, next);
    return next;
  }

  const created: SubscriptionRecord = {
    id: `sub_${idCounter++}`,
    subscriberId,
    transport,
    endpoint,
    topics,
    enabled,
    createdAtISO: timestamp,
    updatedAtISO: timestamp
  };
  subscriptions.set(created.id, created);
  return created;
}

export function removeSubscription(id: string): boolean {
  return subscriptions.delete(id);
}

export function removeSubscriptionsBySubscriber(subscriberId: string): number {
  let removed = 0;
  for (const [id, record] of subscriptions.entries()) {
    if (record.subscriberId !== subscriberId) continue;
    subscriptions.delete(id);
    removed += 1;
  }
  return removed;
}
