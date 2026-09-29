import { CURATED_CHALLENGE_CORPUS, validateChallengeCorpus } from "@/lib/binary2048/challenge-corpus";
import { exhaustiveOptimalActionSequences } from "@/lib/binary2048/challenge-objective";

describe("curated fixed-board challenge corpus", () => {
  it("is versioned, replay-compatible, and satisfies every declared invariant", () => {
    expect(validateChallengeCorpus(CURATED_CHALLENGE_CORPUS)).toBe(CURATED_CHALLENGE_CORPUS);
    expect(CURATED_CHALLENGE_CORPUS.scenarios).toHaveLength(6);
  });

  it("has stable unique scenario identifiers and meaningful skill coverage", () => {
    const ids = CURATED_CHALLENGE_CORPUS.scenarios.map((scenario) => scenario.scenarioId);
    const tags = new Set(CURATED_CHALLENGE_CORPUS.scenarios.flatMap((scenario) => scenario.skillTags));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...tags]).toEqual(expect.arrayContaining(["number-merge", "zero-annihilation", "wildcard", "lock-zero", "win-detection", "bitstorm"]));
  });

  it("locks the dense-board objective to exhaustively optimal four-move sequences", () => {
    const scenario = CURATED_CHALLENGE_CORPUS.scenarios.find((entry) => entry.scenarioId === "asymmetric-edge-choice");
    expect(scenario?.objective).toBeDefined();
    expect(exhaustiveOptimalActionSequences(scenario!.config, scenario!.initialGrid, scenario!.objective!)).toEqual([
      ["D", "L", "R", "U"],
      ["R", "U", "D", "L"]
    ]);
  });

  it("rejects a dense-board contract that omits an optimal sequence", () => {
    const corpus = structuredClone(CURATED_CHALLENGE_CORPUS);
    const scenario = corpus.scenarios.find((entry) => entry.scenarioId === "asymmetric-edge-choice");
    scenario!.objective!.optimalActionSequences = [["D", "L", "R", "U"]];
    expect(() => validateChallengeCorpus(corpus)).toThrow("exhaustive optimal sequences do not match");
  });

  it("rejects corpus version drift", () => {
    expect(() => validateChallengeCorpus({ ...CURATED_CHALLENGE_CORPUS, schemaVersion: 2 })).toThrow("Unsupported curated challenge corpus version");
  });
});
