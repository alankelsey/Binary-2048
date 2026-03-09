import { resetReplayArtifactStoreForTests, shouldArchiveReplayToS3 } from "@/lib/binary2048/replay-artifact-store";

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
});
