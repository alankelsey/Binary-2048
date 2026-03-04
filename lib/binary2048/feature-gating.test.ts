import { getAllowedTopicsForTier, splitTopicsByAccess } from "@/lib/binary2048/feature-gating";

describe("feature gating", () => {
  it("returns allowed topics by tier", () => {
    expect(getAllowedTopicsForTier("guest")).toEqual(["app_updates"]);
    expect(getAllowedTopicsForTier("authed")).toEqual(["app_updates", "player_actions"]);
    expect(getAllowedTopicsForTier("paid")).toEqual([
      "app_updates",
      "player_actions",
      "leaderboard_actions"
    ]);
  });

  it("splits requested topics into allowed and denied sets", () => {
    expect(splitTopicsByAccess("guest", ["app_updates", "player_actions"])).toEqual({
      allowed: ["app_updates"],
      denied: ["player_actions"]
    });
    expect(splitTopicsByAccess("paid", ["app_updates", "leaderboard_actions"])).toEqual({
      allowed: ["app_updates", "leaderboard_actions"],
      denied: []
    });
  });
});
