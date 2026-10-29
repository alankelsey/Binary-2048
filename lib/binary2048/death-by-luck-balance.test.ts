import {
  runDeathByLuckBalanceExperiment,
  runDeathByLuckFixedSeedExperiment
} from "@/lib/binary2048/death-by-luck-balance";

describe("Death by Luck balance experiment", () => {
  it("is deterministic and reports every required outcome and distribution", () => {
    const options = {
      candidates: [{ id: "test", wildcardRate: 0.6, wildcardMultipliers: [2, 4] }],
      seedStart: 30_000,
      runsPerCandidate: 8,
      moveCap: 80,
      winTile: 64
    };
    const first = runDeathByLuckBalanceExperiment(options);
    const second = runDeathByLuckBalanceExperiment(options);

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({ id: "test", runs: 8, wildcardRate: 0.6 });
    expect(first[0].winRate + first[0].boardFillLossRate + first[0].cappedRate).toBeCloseTo(1);
    expect(first[0].moves).toEqual(expect.objectContaining({ p10: expect.any(Number), p50: expect.any(Number), p90: expect.any(Number), mean: expect.any(Number) }));
    expect(first[0].winMoves === null || first[0].winMoves.p50 >= 0).toBe(true);
    expect(first[0].lossMoves === null || first[0].lossMoves.p50 >= 0).toBe(true);
    expect(first[0].score.p90).toBeGreaterThanOrEqual(first[0].score.p10);
    expect(first[0].maxTile.p90).toBeGreaterThanOrEqual(first[0].maxTile.p10);
    expect(first[0].seedQuartileWinRateRange).toBeGreaterThanOrEqual(0);
    expect(first[0].movesP90P10Ratio).toBeGreaterThanOrEqual(1);
  });

  it("replays named fixed seeds exactly", () => {
    const options = {
      candidates: [{ id: "test", wildcardRate: 0.6, wildcardMultipliers: [2, 4] }],
      seeds: [30_001, 30_002],
      moveCap: 80,
      winTile: 64
    };

    const first = runDeathByLuckFixedSeedExperiment(options);
    expect(first).toEqual(runDeathByLuckFixedSeedExperiment(options));
    expect(first.map((result) => result.seed)).toEqual([30_001, 30_002]);
    expect(first[0]).toEqual(expect.objectContaining({
      outcome: expect.stringMatching(/^(win|loss|capped)$/),
      moves: expect.any(Number),
      score: expect.any(Number),
      maxTile: expect.any(Number)
    }));
  });
});
