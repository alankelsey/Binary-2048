export const SUPPORT_MODE_STORAGE_KEY = "binary2048.supportMode.v1";
export const SUPPORT_MODE_TTL_MS = 30 * 60 * 1000;

type SupportModeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SupportModeState = {
  enabled: true;
  expiresAt: number;
};

export function readSupportMode(storage: SupportModeStorage, now = Date.now()): SupportModeState | null {
  try {
    const raw = storage.getItem(SUPPORT_MODE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; expiresAt?: unknown };
    if (parsed.version !== 1 || typeof parsed.expiresAt !== "number" || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now) {
      storage.removeItem(SUPPORT_MODE_STORAGE_KEY);
      return null;
    }
    return { enabled: true, expiresAt: parsed.expiresAt };
  } catch {
    try { storage.removeItem(SUPPORT_MODE_STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
    return null;
  }
}

export function enableSupportMode(
  storage: SupportModeStorage,
  now = Date.now(),
  ttlMs = SUPPORT_MODE_TTL_MS
): SupportModeState | null {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return null;
  const state: SupportModeState = { enabled: true, expiresAt: now + ttlMs };
  try {
    storage.setItem(SUPPORT_MODE_STORAGE_KEY, JSON.stringify({ version: 1, expiresAt: state.expiresAt }));
    return state;
  } catch {
    return null;
  }
}

export function disableSupportMode(storage: SupportModeStorage) {
  try { storage.removeItem(SUPPORT_MODE_STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
}
