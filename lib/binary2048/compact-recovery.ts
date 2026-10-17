import { COMPACT_CHECKPOINT_INTERVAL } from "@/lib/binary2048/compact-sync";
import type { Dir, SessionRecoverySnapshot } from "@/lib/binary2048/types";

export const COMPACT_RECOVERY_VERSION = "checkpoint-tail-v1";
export const MAX_COMPACT_RECOVERY_TAIL = COMPACT_CHECKPOINT_INTERVAL - 1;
export const MAX_COMPACT_PENDING_TAIL = 9;

export type CompactRecoveryPayload = {
  version: typeof COMPACT_RECOVERY_VERSION;
  checkpoint: SessionRecoverySnapshot;
  acknowledgedTail: Dir[];
};

export type DurableCompactRecovery = CompactRecoveryPayload & {
  pendingTail: Dir[];
};

const DIRECTIONS = new Set<Dir>(["up", "down", "left", "right"]);

export function isDirection(value: unknown): value is Dir {
  return typeof value === "string" && DIRECTIONS.has(value as Dir);
}

function isDirectionTail(value: unknown, maximum: number): value is Dir[] {
  return Array.isArray(value) && value.length <= maximum && value.every(isDirection);
}

export function isCompactRecoveryPayload(value: unknown): value is CompactRecoveryPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<CompactRecoveryPayload>;
  return (
    payload.version === COMPACT_RECOVERY_VERSION &&
    Boolean(payload.checkpoint && typeof payload.checkpoint === "object") &&
    isDirectionTail(payload.acknowledgedTail, MAX_COMPACT_RECOVERY_TAIL)
  );
}

export function isDurableCompactRecovery(value: unknown): value is DurableCompactRecovery {
  return (
    isCompactRecoveryPayload(value) &&
    isDirectionTail((value as Partial<DurableCompactRecovery>).pendingTail, MAX_COMPACT_PENDING_TAIL)
  );
}
