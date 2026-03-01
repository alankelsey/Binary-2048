import { applyMove, createGame } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

const baseConfig: GameConfig = {
  width: 2,
  height: 2,
  seed: 7,
  winTile: 2048,
  zeroBehavior: "annihilate",
  spawnOnNoopMove: false,
  spawn: {
    pZero: 0,
    pOne: 1,
    pWildcard: 0,
    wildcardMultipliers: [2]
  }
};

function countTiles(grid: Cell[][], type: "z" | "w" | "n"): number {
  return grid.flat().filter((cell) => cell?.t === type).length;
}

describe("zero tile collision rules", () => {
  it("keeps zero on the board when no collision occurs", () => {
    const initialGrid: Cell[][] = [[{ t: "z" }, null], [{ t: "n", v: 1 }, { t: "n", v: 2 }]];
    const { state } = createGame(baseConfig, initialGrid);
    const moved = applyMove(state, "right");

    expect(countTiles(moved.state.grid, "z")).toBe(1);
  });

  it("removes both zero and wildcard on collision", () => {
    const initialGrid: Cell[][] = [[{ t: "z" }, { t: "w", m: 2 }], [{ t: "n", v: 1 }, { t: "n", v: 2 }]];
    const { state } = createGame(baseConfig, initialGrid);
    const moved = applyMove(state, "left");

    expect(countTiles(moved.state.grid, "z")).toBe(0);
    expect(countTiles(moved.state.grid, "w")).toBe(0);
  });
});
