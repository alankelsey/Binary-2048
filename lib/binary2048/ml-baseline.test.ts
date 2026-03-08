import { runOfflineBaseline, splitTrainTest } from "@/lib/binary2048/ml-baseline";

const rows = Array.from({ length: 40 }, (_, i) => ({
  runId: `run_${i}`,
  labelScore: 100 + i * 5,
  labelMaxTile: 8 + (i % 6) * 2,
  f_moves: 10 + i,
  f_scorePerMove: 3 + i * 0.1,
  f_maxTilePerMove: 0.5 + (i % 4) * 0.2,
  f_actionEntropyApprox: 1.2 + (i % 3) * 0.1,
  f_boardSize: 4,
  f_tier: (i % 3) as 0 | 1 | 2
}));

describe("ml baseline", () => {
  it("splits deterministically", () => {
    const first = splitTrainTest(rows);
    const second = splitTrainTest(rows);
    expect(first.train.length).toBe(second.train.length);
    expect(first.test.length).toBe(second.test.length);
    expect(first.train.map((r) => r.runId)).toEqual(second.train.map((r) => r.runId));
  });

  it("produces train/test metrics", () => {
    const report = runOfflineBaseline(rows);
    expect(report.model).toBe("linear-gd-v1");
    expect(report.trainCount).toBeGreaterThan(0);
    expect(report.testCount).toBeGreaterThan(0);
    expect(report.score.mae).toBeGreaterThanOrEqual(0);
    expect(report.maxTile.rmse).toBeGreaterThanOrEqual(0);
  });
});
