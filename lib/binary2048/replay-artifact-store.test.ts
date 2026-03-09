import {
  getReplayArtifactStore,
  resetReplayArtifactStoreForTests,
  shouldArchiveReplayToS3
} from "@/lib/binary2048/replay-artifact-store";

describe("replay-artifact-store policy", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetReplayArtifactStoreForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("archives contest runs regardless of score", () => {
    process.env.BINARY2048_REPLAY_S3_MIN_SCORE = "5000";
    expect(shouldArchiveReplayToS3({ score: 100, contestId: "c1" })).toBe(true);
  });

  it("archives high-score runs by default threshold", () => {
    delete process.env.BINARY2048_REPLAY_S3_MIN_SCORE;
    expect(shouldArchiveReplayToS3({ score: 3000 })).toBe(true);
    expect(shouldArchiveReplayToS3({ score: 100 })).toBe(false);
  });

  it("respects contest-only mode", () => {
    process.env.BINARY2048_REPLAY_S3_CONTEST_ONLY = "true";
    expect(shouldArchiveReplayToS3({ score: 9999 })).toBe(false);
    expect(shouldArchiveReplayToS3({ score: 1, contestId: "c2" })).toBe(true);
  });

  it("uses inline store by default and does not persist payload", async () => {
    delete process.env.BINARY2048_REPLAY_ARTIFACT_STORE;
    const store = getReplayArtifactStore();
    const ref = await store.persistIfConfigured(
      "run_inline_1",
      {
        header: {
          replayVersion: 1,
          rulesetId: "binary2048-v1",
          engineVersion: "dev",
          size: 4,
          seed: 1,
          createdAt: new Date().toISOString()
        },
        config: {
          width: 4,
          height: 4,
          seed: 1,
          winTile: 2048,
          zeroBehavior: "annihilate",
          spawnOnNoopMove: false,
          spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2] }
        },
        initialGrid: Array.from({ length: 4 }, () => [null, null, null, null]),
        moves: ["L"]
      },
      { score: 42 }
    );
    expect(ref).toEqual({ kind: "inline" });
    await expect(store.load(ref)).resolves.toBeNull();
  });

  it("throws when s3 mode is enabled without bucket", () => {
    process.env.BINARY2048_REPLAY_ARTIFACT_STORE = "s3";
    delete process.env.BINARY2048_REPLAY_S3_BUCKET;
    expect(() => getReplayArtifactStore()).toThrow(
      "BINARY2048_REPLAY_S3_BUCKET is required when BINARY2048_REPLAY_ARTIFACT_STORE=s3"
    );
  });

  it("returns inline ref in s3 mode when score does not meet archive policy", async () => {
    process.env.BINARY2048_REPLAY_ARTIFACT_STORE = "s3";
    process.env.BINARY2048_REPLAY_S3_BUCKET = "binary2048-test-bucket";
    process.env.BINARY2048_REPLAY_S3_MIN_SCORE = "5000";
    const store = getReplayArtifactStore();
    const ref = await store.persistIfConfigured(
      "run_s3_policy_skip",
      {
        header: {
          replayVersion: 1,
          rulesetId: "binary2048-v1",
          engineVersion: "dev",
          size: 4,
          seed: 1,
          createdAt: new Date().toISOString()
        },
        config: {
          width: 4,
          height: 4,
          seed: 1,
          winTile: 2048,
          zeroBehavior: "annihilate",
          spawnOnNoopMove: false,
          spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2] }
        },
        initialGrid: Array.from({ length: 4 }, () => [null, null, null, null]),
        moves: ["L"]
      },
      { score: 120 }
    );
    expect(ref).toEqual({ kind: "inline" });
  });
});
