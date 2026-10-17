import {
  COMPACT_RECOVERY_VERSION,
  MAX_COMPACT_PENDING_TAIL,
  MAX_COMPACT_RECOVERY_TAIL,
  isCompactRecoveryPayload,
  isDurableCompactRecovery
} from "@/lib/binary2048/compact-recovery";

const checkpoint = {
  recoveryVersion: 1 as const,
  rulesetId: "binary2048-v1" as const,
  config: {},
  initialGrid: [],
  moves: []
};

describe("compact recovery payload", () => {
  it("accepts bounded acknowledged and pending tails", () => {
    const payload = {
      version: COMPACT_RECOVERY_VERSION,
      checkpoint,
      acknowledgedTail: Array.from({ length: MAX_COMPACT_RECOVERY_TAIL }, () => "left"),
      pendingTail: Array.from({ length: MAX_COMPACT_PENDING_TAIL }, () => "right")
    };
    expect(isCompactRecoveryPayload(payload)).toBe(true);
    expect(isDurableCompactRecovery(payload)).toBe(true);
  });

  it("rejects unknown versions, directions, and unbounded tails", () => {
    expect(isCompactRecoveryPayload({ version: "future", checkpoint, acknowledgedTail: [] })).toBe(false);
    expect(isCompactRecoveryPayload({
      version: COMPACT_RECOVERY_VERSION,
      checkpoint,
      acknowledgedTail: ["diagonal"]
    })).toBe(false);
    expect(isCompactRecoveryPayload({
      version: COMPACT_RECOVERY_VERSION,
      checkpoint,
      acknowledgedTail: Array.from({ length: MAX_COMPACT_RECOVERY_TAIL + 1 }, () => "left")
    })).toBe(false);
    expect(isDurableCompactRecovery({
      version: COMPACT_RECOVERY_VERSION,
      checkpoint,
      acknowledgedTail: [],
      pendingTail: Array.from({ length: MAX_COMPACT_PENDING_TAIL + 1 }, () => "left")
    })).toBe(false);
  });
});
