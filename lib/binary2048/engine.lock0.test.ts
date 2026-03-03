import { applyMove, createGame } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

const baseConfig: GameConfig = {
  width: 3,
  height: 2,
  seed: 11,
  winTile: 2048,
  zeroBehavior: "annihilate",
  spawnOnNoopMove: false,
  spawn: {
    pZero: 1,
    pOne: 0,
    pWildcard: 0,
    pLock: 0,
    wildcardMultipliers: [2]
  }
};

function countTiles(grid: Cell[][], type: "i" | "n"): number {
  return grid.flat().filter((cell) => cell?.t === type).length;
}

describe("lock-0 cooldown behavior", () => {
  it("blocks annihilation on first collision turn and logs lock_block", () => {
    const initialGrid: Cell[][] = [
      [{ t: "i" }, { t: "n", v: 1 }, null],
      [null, null, null]
    ];
    const { state } = createGame(baseConfig, initialGrid);

    const moved = applyMove(state, "right");
    expect(moved.state.turn).toBe(1);
    expect(countTiles(moved.state.grid, "i")).toBe(1);
    expect(countTiles(moved.state.grid, "n")).toBe(1);
    expect(moved.events.some((event) => event.type === "lock_block")).toBe(true);
  });

  it("annihilates like zero on the next moved turn and logs lock_break", () => {
    const initialGrid: Cell[][] = [
      [{ t: "i" }, { t: "n", v: 1 }, null],
      [null, null, null]
    ];
    const { state } = createGame(baseConfig, initialGrid);

    const first = applyMove(state, "right");
    const second = applyMove(first.state, "left");

    expect(second.state.turn).toBe(2);
    expect(countTiles(second.state.grid, "i")).toBe(0);
    expect(countTiles(second.state.grid, "n")).toBe(1);
    expect(second.events.some((event) => event.type === "lock_break")).toBe(true);
  });
});
