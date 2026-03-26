import { clearResumeSnapshot, loadResumeSnapshot, RESUME_SNAPSHOT_STORAGE_KEY, saveResumeSnapshot } from "@/lib/binary2048/resume-recovery";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("resume recovery snapshot", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 515,
    winTile: 2048,
    zeroBehavior: "annihilate",
    spawnOnNoopMove: false,
    spawn: {
      pZero: 0.1,
      pOne: 0.8,
      pWildcard: 0.1,
      pLock: 0,
      wildcardMultipliers: [2]
    }
  };

  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  it("stores and restores a full export by game id", () => {
    const exported = runScenario(config, initialGrid, ["left"]);
    const values = new Map<string, string>();
    const storage = {
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      removeItem(key: string) {
        values.delete(key);
      }
    };

    saveResumeSnapshot(storage, exported.final.id, exported);

    expect(loadResumeSnapshot(storage, exported.final.id)?.meta.replay.moves).toEqual(["left"]);
    expect(loadResumeSnapshot(storage, "different-id")).toBeNull();

    clearResumeSnapshot(storage);
    expect(values.has(RESUME_SNAPSHOT_STORAGE_KEY)).toBe(false);
  });

  it("returns null for malformed snapshot payloads", () => {
    const storage = {
      getItem() {
        return "{not-json";
      }
    };

    expect(loadResumeSnapshot(storage)).toBeNull();
  });
});
