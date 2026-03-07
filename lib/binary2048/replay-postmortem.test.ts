import { buildReplayPostmortem } from "@/lib/binary2048/replay-postmortem";
import { runScenario, DEFAULT_CONFIG } from "@/lib/binary2048/engine";

describe("buildReplayPostmortem", () => {
  it("returns ranked costly moves for a replay payload", () => {
    const exported = runScenario(
      { ...DEFAULT_CONFIG, seed: 1234 },
      [
        [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
      ],
      ["left", "up", "right", "right", "down"]
    );
    const result = buildReplayPostmortem(exported, 3);
    expect(result.analyzedMoves).toBeGreaterThan(0);
    expect(result.topCostlyMoves).toHaveLength(3);
    expect(result.topCostlyMoves[0]?.opportunityCost).toBeGreaterThanOrEqual(result.topCostlyMoves[1]?.opportunityCost ?? 0);
  });

  it("accepts compact replay payload", () => {
    const payload = {
      header: {
        replayVersion: 1 as const,
        rulesetId: "binary2048-v1",
        engineVersion: "test",
        size: 4,
        seed: 99,
        createdAt: new Date().toISOString()
      },
      config: { ...DEFAULT_CONFIG, seed: 99 },
      initialGrid: [
        [{ t: "n", v: 1 }, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
      ],
      moves: ["R", "D", "L", "U"]
    };
    const result = buildReplayPostmortem(payload, 2);
    expect(result.topCostlyMoves).toHaveLength(2);
  });
});
