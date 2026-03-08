import { extractMlFeatures } from "@/lib/binary2048/ml-features";

describe("extractMlFeatures", () => {
  it("extracts deterministic numeric features", () => {
    const features = extractMlFeatures({
      runId: "run_1",
      anonPlayerId: "anon_1",
      userTier: "authed",
      score: 120,
      maxTile: 32,
      moves: 10,
      seed: 1,
      rulesetId: "binary2048-v1",
      engineVersion: "v1",
      replay: {
        header: { size: 4 },
        moves: ["L", "R", "L", "U", "D", "L"]
      }
    });
    expect(features.f_moves).toBe(10);
    expect(features.f_tier).toBe(1);
    expect(features.f_boardSize).toBe(4);
    expect(features.f_actionEntropyApprox).toBeGreaterThan(0);
  });
});
