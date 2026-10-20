import {
  SUPPORT_MODE_STORAGE_KEY,
  disableSupportMode,
  enableSupportMode,
  readSupportMode
} from "@/lib/binary2048/support-mode";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

describe("support mode preference", () => {
  it("persists a bounded activation and restores it before expiry", () => {
    const target = storage();
    expect(enableSupportMode(target, 1_000, 30_000)).toEqual({ enabled: true, expiresAt: 31_000 });
    expect(readSupportMode(target, 30_999)).toEqual({ enabled: true, expiresAt: 31_000 });
  });

  it("removes expired, corrupt, and explicitly disabled preferences", () => {
    const target = storage();
    enableSupportMode(target, 1_000, 30_000);
    expect(readSupportMode(target, 31_000)).toBeNull();
    target.setItem(SUPPORT_MODE_STORAGE_KEY, "not-json");
    expect(readSupportMode(target, 2_000)).toBeNull();
    enableSupportMode(target, 2_000, 30_000);
    disableSupportMode(target);
    expect(readSupportMode(target, 2_001)).toBeNull();
  });
});
