export type RageTapState = {
  key: string | null;
  count: number;
  lastAt: number;
};

export function createInitialRageTapState(): RageTapState {
  return {
    key: null,
    count: 0,
    lastAt: 0
  };
}

export function recordRageTap(
  previous: RageTapState,
  key: string,
  now: number,
  options?: {
    threshold?: number;
    windowMs?: number;
  }
): { next: RageTapState; shouldTrack: boolean } {
  const threshold = options?.threshold ?? 3;
  const windowMs = options?.windowMs ?? 1200;
  const withinWindow = previous.key === key && now - previous.lastAt <= windowMs;
  const count = withinWindow ? previous.count + 1 : 1;
  return {
    next: {
      key,
      count,
      lastAt: now
    },
    shouldTrack: count === threshold
  };
}

export function normalizeAuditControlLabel(text: string | null | undefined): string {
  const normalized = (text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 48);
  return normalized || "unknown";
}
