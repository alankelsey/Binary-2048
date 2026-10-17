export const COMPACT_SYNC_VERSION = "turn-hash-checkpoint-v1";
export const COMPACT_CHECKPOINT_INTERVAL = 25;

export function isCompactSyncVersion(value: unknown): value is typeof COMPACT_SYNC_VERSION {
  return value === COMPACT_SYNC_VERSION;
}

export function shouldIssueCompactCheckpoint(input: {
  turn: number;
  terminal: boolean;
  recovered: boolean;
}) {
  return input.terminal || input.recovered || input.turn % COMPACT_CHECKPOINT_INTERVAL === 0;
}
