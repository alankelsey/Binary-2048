import { runScenario, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import { buildCanonicalRunRecord } from "@/lib/binary2048/run-record";

describe("buildCanonicalRunRecord", () => {
  it("builds canonical run fields from export payload", () => {
    const exported = runScenario(
      { ...DEFAULT_CONFIG, seed: 5150 },
      [
        [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null]
      ],
      ["left", "up"]
    );
    const record = buildCanonicalRunRecord({
      id: "run_g1",
      playerId: "u1",
      userTier: "authed",
      gameId: exported.final.id,
      exported,
      integrity: { sessionClass: "ranked", source: "created" },
      replaySignature: "sig"
    });
    expect(record.id).toBe("run_g1");
    expect(record.seed).toBe(5150);
    expect(record.score).toBe(exported.final.score);
    expect(record.rulesetId).toBe("binary2048-v1");
    expect(record.replay).toBeDefined();
    expect(Array.isArray(record.replay?.moves)).toBe(true);
  });
});
