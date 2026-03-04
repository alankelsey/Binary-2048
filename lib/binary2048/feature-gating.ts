import type { SubscriptionTopic } from "@/lib/binary2048/subscriptions";
import type { UserTier } from "@/lib/binary2048/security-policy";

export const TOPIC_ACCESS_BY_TIER: Record<UserTier, SubscriptionTopic[]> = {
  guest: ["app_updates"],
  authed: ["app_updates", "player_actions"],
  paid: ["app_updates", "player_actions", "leaderboard_actions"]
};

export function getAllowedTopicsForTier(tier: UserTier): SubscriptionTopic[] {
  return [...TOPIC_ACCESS_BY_TIER[tier]];
}

export function splitTopicsByAccess(
  tier: UserTier,
  topics: SubscriptionTopic[]
): { allowed: SubscriptionTopic[]; denied: SubscriptionTopic[] } {
  const allowedSet = new Set(TOPIC_ACCESS_BY_TIER[tier]);
  const allowed: SubscriptionTopic[] = [];
  const denied: SubscriptionTopic[] = [];
  for (const topic of topics) {
    if (allowedSet.has(topic)) allowed.push(topic);
    else denied.push(topic);
  }
  return { allowed, denied };
}
