import { formatSubmittedAt, rankClass, shortPlayerId, TIER_LABEL } from "@/lib/binary2048/leaderboard-view";

describe("leaderboard-view formatting helpers", () => {
  it("classes the top 3 ranks distinctly and leaves the rest plain", () => {
    expect(rankClass(1)).toBe("leaderboard-rank top-1");
    expect(rankClass(2)).toBe("leaderboard-rank top-2");
    expect(rankClass(3)).toBe("leaderboard-rank top-3");
    expect(rankClass(4)).toBe("leaderboard-rank");
    expect(rankClass(100)).toBe("leaderboard-rank");
  });

  it("formats an ISO submission timestamp as a compact UTC string", () => {
    expect(formatSubmittedAt("2026-09-15T18:04:31.000Z")).toBe("2026-09-15 18:04 UTC");
  });

  it("falls back to a dash for a missing or malformed timestamp", () => {
    expect(formatSubmittedAt("")).toBe("-");
    expect(formatSubmittedAt("not-a-date")).toBe("-");
  });

  it("leaves short player ids untouched", () => {
    expect(shortPlayerId("guest_42")).toBe("guest_42");
  });

  it("truncates long player ids to a readable head/tail form", () => {
    expect(shortPlayerId("authed_user_abcdef1234567890")).toBe("authed…7890");
  });

  it("labels every user tier", () => {
    expect(TIER_LABEL.guest).toBe("Guest");
    expect(TIER_LABEL.authed).toBe("Player");
    expect(TIER_LABEL.paid).toBe("Pro");
  });
});
