import type { GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";

export const RESUME_SNAPSHOT_STORAGE_KEY = "binary2048.resumeSnapshot";

type ResumeSnapshotEnvelope = {
  gameId: string;
  savedAtISO: string;
  exported: GameExport | SessionRecoverySnapshot;
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

export function loadResumeSnapshot(
  storage: Pick<Storage, "getItem">,
  gameId?: string
): GameExport | SessionRecoverySnapshot | null {
  return loadResumeSnapshotWithMetrics(storage, gameId).snapshot;
}

export function clearResumeSnapshot(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(RESUME_SNAPSHOT_STORAGE_KEY);
}
