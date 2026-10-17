import {
  COMPACT_CHECKPOINT_INTERVAL,
  COMPACT_SYNC_VERSION,
  isCompactSyncVersion,
  shouldIssueCompactCheckpoint
} from "@/lib/binary2048/compact-sync";

describe("compact move synchronization", () => {
  it("accepts only the current protocol version", () => {
    expect(isCompactSyncVersion(COMPACT_SYNC_VERSION)).toBe(true);
    expect(isCompactSyncVersion("turn-hash-checkpoint-v2")).toBe(false);
    expect(isCompactSyncVersion(undefined)).toBe(false);
  });

  it("issues periodic, terminal, and recovery checkpoints", () => {
    expect(COMPACT_CHECKPOINT_INTERVAL).toBe(25);
    expect(shouldIssueCompactCheckpoint({ turn: 24, terminal: false, recovered: false })).toBe(false);
    expect(shouldIssueCompactCheckpoint({ turn: 25, terminal: false, recovered: false })).toBe(true);
    expect(shouldIssueCompactCheckpoint({ turn: 7, terminal: true, recovered: false })).toBe(true);
    expect(shouldIssueCompactCheckpoint({ turn: 7, terminal: false, recovered: true })).toBe(true);
  });
});
