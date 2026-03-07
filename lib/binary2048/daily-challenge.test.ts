import { getDailyChallenge, listDailyChallengeEntries, resetDailyChallengeStore, submitDailyChallengeReplay } from "@/lib/binary2048/daily-challenge";
import { runScenario } from "@/lib/binary2048/engine";

describe("daily challenge", () => {
  beforeEach(() => resetDailyChallengeStore());

  it("returns deterministic challenge seed per UTC day", () => {
    const date = new Date("2026-03-07T12:00:00.000Z");
    const a = getDailyChallenge(date);
    const b = getDailyChallenge(date);
    expect(a.seed).toBe(b.seed);
    expect(a.challengeId).toBe("daily_2026-03-07");
  });

  it("accepts replay for today's seed and ranks entries", () => {
    const date = new Date("2026-03-07T05:00:00.000Z");
    const challenge = getDailyChallenge(date);
    const replay = runScenario(challenge.config, challenge.initialGrid, ["left", "up", "right"]);
    const first = submitDailyChallengeReplay("p1", replay, date);
    const second = submitDailyChallengeReplay("p2", replay, date);
    expect(first.entry.challengeId).toBe(challenge.challengeId);
    expect(second.total).toBe(2);
    expect(listDailyChallengeEntries(challenge.challengeId, 10).length).toBe(2);
  });

  it("rejects replay with non-daily seed", () => {
    const date = new Date("2026-03-07T05:00:00.000Z");
    const challenge = getDailyChallenge(date);
    const badReplay = runScenario({ ...challenge.config, seed: challenge.seed + 1 }, challenge.initialGrid, ["left"]);
    expect(() => submitDailyChallengeReplay("p1", badReplay, date)).toThrow("Replay seed does not match");
  });
});
