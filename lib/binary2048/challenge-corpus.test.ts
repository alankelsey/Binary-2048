import { CURATED_CHALLENGE_CORPUS, validateChallengeCorpus } from "@/lib/binary2048/challenge-corpus";

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

  it("rejects corpus version drift", () => {
    expect(() => validateChallengeCorpus({ ...CURATED_CHALLENGE_CORPUS, schemaVersion: 2 })).toThrow("Unsupported curated challenge corpus version");
  });
});
