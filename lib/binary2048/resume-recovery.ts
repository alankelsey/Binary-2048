import type { GameExport } from "@/lib/binary2048/types";

export const RESUME_SNAPSHOT_STORAGE_KEY = "binary2048.resumeSnapshot";

type ResumeSnapshotEnvelope = {
  gameId: string;
  savedAtISO: string;
  exported: GameExport;
};

export function saveResumeSnapshot(
  storage: Pick<Storage, "setItem">,
  gameId: string,
  exported: GameExport
) {
  const payload: ResumeSnapshotEnvelope = {
    gameId,
    savedAtISO: new Date().toISOString(),
    exported
  };
  storage.setItem(RESUME_SNAPSHOT_STORAGE_KEY, JSON.stringify(payload));
}

export function loadResumeSnapshot(
  storage: Pick<Storage, "getItem">,
  gameId?: string
): GameExport | null {
  const raw = storage.getItem(RESUME_SNAPSHOT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ResumeSnapshotEnvelope>;
    if (!parsed || typeof parsed !== "object") return null;
    if (gameId && parsed.gameId !== gameId) return null;
    if (!parsed.exported || typeof parsed.exported !== "object") return null;
    return parsed.exported as GameExport;
  } catch {
    return null;
  }
}

export function clearResumeSnapshot(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(RESUME_SNAPSHOT_STORAGE_KEY);
}
