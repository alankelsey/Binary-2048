import type { GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";
import {
  COMPACT_RECOVERY_VERSION,
  isDurableCompactRecovery,
  type DurableCompactRecovery
} from "@/lib/binary2048/compact-recovery";

export const RESUME_SNAPSHOT_STORAGE_KEY = "binary2048.resumeSnapshot";

type ResumeSnapshotEnvelope = {
  gameId: string;
  savedAtISO: string;
  exported: GameExport | SessionRecoverySnapshot;
};

type CompactResumeSnapshotEnvelope = {
  version: typeof COMPACT_RECOVERY_VERSION;
  gameId: string;
  savedAtISO: string;
  recovery: DurableCompactRecovery;
};

type Clock = () => number;

export type ResumeSnapshotSaveMetrics = {
  checkpointDurationMs: number;
  localStorageDurationMs: number;
};

export type ResumeSnapshotLoadResult = {
  snapshot: GameExport | SessionRecoverySnapshot | null;
  localStorageDurationMs: number;
};

export type CompactResumeLoadResult = {
  recovery: DurableCompactRecovery | null;
  localStorageDurationMs: number;
};

function defaultClock() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function saveResumeSnapshot(
  storage: Pick<Storage, "setItem">,
  gameId: string,
  exported: GameExport | SessionRecoverySnapshot,
  now: Clock = defaultClock
): ResumeSnapshotSaveMetrics {
  const checkpointStartedAt = now();
  const payload: ResumeSnapshotEnvelope = {
    gameId,
    savedAtISO: new Date().toISOString(),
    exported
  };
  const serialized = JSON.stringify(payload);
  const storageStartedAt = now();
  storage.setItem(RESUME_SNAPSHOT_STORAGE_KEY, serialized);
  const storageFinishedAt = now();
  return {
    checkpointDurationMs: Math.max(0, storageFinishedAt - checkpointStartedAt),
    localStorageDurationMs: Math.max(0, storageFinishedAt - storageStartedAt)
  };
}

export function saveCompactResumeRecovery(
  storage: Pick<Storage, "setItem">,
  gameId: string,
  recovery: DurableCompactRecovery,
  now: Clock = defaultClock
): ResumeSnapshotSaveMetrics {
  const checkpointStartedAt = now();
  const payload: CompactResumeSnapshotEnvelope = {
    version: COMPACT_RECOVERY_VERSION,
    gameId,
    savedAtISO: new Date().toISOString(),
    recovery
  };
  const serialized = JSON.stringify(payload);
  const storageStartedAt = now();
  storage.setItem(RESUME_SNAPSHOT_STORAGE_KEY, serialized);
  const storageFinishedAt = now();
  return {
    checkpointDurationMs: Math.max(0, storageFinishedAt - checkpointStartedAt),
    localStorageDurationMs: Math.max(0, storageFinishedAt - storageStartedAt)
  };
}

export function loadResumeSnapshotWithMetrics(
  storage: Pick<Storage, "getItem">,
  gameId?: string,
  now: Clock = defaultClock
): ResumeSnapshotLoadResult {
  const storageStartedAt = now();
  const raw = storage.getItem(RESUME_SNAPSHOT_STORAGE_KEY);
  const storageFinishedAt = now();
  const localStorageDurationMs = Math.max(0, storageFinishedAt - storageStartedAt);
  if (!raw) return { snapshot: null, localStorageDurationMs };

  try {
    const parsed = JSON.parse(raw) as Partial<ResumeSnapshotEnvelope>;
    if (!parsed || typeof parsed !== "object") return { snapshot: null, localStorageDurationMs };
    if (gameId && parsed.gameId !== gameId) return { snapshot: null, localStorageDurationMs };
    if (!parsed.exported || typeof parsed.exported !== "object") {
      return { snapshot: null, localStorageDurationMs };
    }
    return {
      snapshot: parsed.exported as GameExport | SessionRecoverySnapshot,
      localStorageDurationMs
    };
  } catch {
    return { snapshot: null, localStorageDurationMs };
  }
}

export function loadCompactResumeRecoveryWithMetrics(
  storage: Pick<Storage, "getItem">,
  gameId?: string,
  now: Clock = defaultClock
): CompactResumeLoadResult {
  const storageStartedAt = now();
  const raw = storage.getItem(RESUME_SNAPSHOT_STORAGE_KEY);
  const storageFinishedAt = now();
  const localStorageDurationMs = Math.max(0, storageFinishedAt - storageStartedAt);
  if (!raw) return { recovery: null, localStorageDurationMs };

  try {
    const parsed = JSON.parse(raw) as Partial<CompactResumeSnapshotEnvelope>;
    if (!parsed || typeof parsed !== "object") return { recovery: null, localStorageDurationMs };
    if (parsed.version !== COMPACT_RECOVERY_VERSION) return { recovery: null, localStorageDurationMs };
    if (gameId && parsed.gameId !== gameId) return { recovery: null, localStorageDurationMs };
    if (!isDurableCompactRecovery(parsed.recovery)) return { recovery: null, localStorageDurationMs };
    return { recovery: parsed.recovery, localStorageDurationMs };
  } catch {
    return { recovery: null, localStorageDurationMs };
  }
}

export function loadResumeSnapshot(
  storage: Pick<Storage, "getItem">,
  gameId?: string
): GameExport | SessionRecoverySnapshot | null {
  return loadResumeSnapshotWithMetrics(storage, gameId).snapshot;
}

export function clearResumeSnapshot(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(RESUME_SNAPSHOT_STORAGE_KEY);
}
