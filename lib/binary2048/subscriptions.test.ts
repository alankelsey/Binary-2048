import { listSubscriptions, normalizeTopics, removeSubscription, upsertSubscription } from "@/lib/binary2048/subscriptions";

describe("subscriptions store", () => {
  it("normalizes allowed topics only", () => {
    expect(normalizeTopics(["app_updates", "bad_topic", "player_actions"])).toEqual([
      "app_updates",
      "player_actions"
    ]);
  });

  it("upserts and lists by subscriber", () => {
    const first = upsertSubscription({
      subscriberId: "user-1",
      transport: "email",
      endpoint: "user@example.com",
      topics: ["app_updates"],
      enabled: true
    });
    const second = upsertSubscription({
      subscriberId: "user-1",
      transport: "email",
      endpoint: "user@example.com",
      topics: ["player_actions", "leaderboard_actions"],
      enabled: false
    });

    expect(second.id).toBe(first.id);
    expect(second.enabled).toBe(false);
    expect(second.topics).toEqual(["player_actions", "leaderboard_actions"]);
    const listed = listSubscriptions("user-1");
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(first.id);
  });

  it("removes by id", () => {
    const record = upsertSubscription({
      subscriberId: "user-remove",
      transport: "inapp",
      endpoint: "user-remove",
      topics: ["app_updates"],
      enabled: true
    });
    expect(removeSubscription(record.id)).toBe(true);
    expect(removeSubscription("missing_sub")).toBe(false);
  });
});
