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

  it("ends a full board when an even-turn lock cannot be broken", () => {
    const initialGrid: Cell[][] = [
      [{ t: "n", v: 4 }, { t: "n", v: 2 }, { t: "n", v: 1 }, { t: "i" }],
      [{ t: "n", v: 1 }, { t: "n", v: 8 }, { t: "n", v: 4 }, { t: "n", v: 1 }],
      [{ t: "n", v: 8 }, { t: "n", v: 32 }, { t: "n", v: 8 }, { t: "n", v: 2 }],
      [{ t: "n", v: 16 }, { t: "n", v: 1 }, { t: "n", v: 32 }, { t: "n", v: 8 }]
    ];
    const config: GameConfig = { ...baseConfig, width: 4, height: 4 };
    const created = createGame(config, initialGrid).state;
    const evenTurnState = { ...created, turn: 96, over: false };

    const result = applyMove(evenTurnState, "left");

    expect(result.moved).toBe(false);
    expect(result.state.turn).toBe(96);
    expect(result.state.over).toBe(true);
    expect(result.events.some((event) => event.type === "game_over")).toBe(true);
  });

  it("keeps a full board active when an odd-turn lock can be broken", () => {
    const initialGrid: Cell[][] = [
      [{ t: "n", v: 4 }, { t: "n", v: 2 }, { t: "n", v: 1 }, { t: "i" }],
      [{ t: "n", v: 1 }, { t: "n", v: 8 }, { t: "n", v: 4 }, { t: "n", v: 1 }],
      [{ t: "n", v: 8 }, { t: "n", v: 32 }, { t: "n", v: 8 }, { t: "n", v: 2 }],
      [{ t: "n", v: 16 }, { t: "n", v: 1 }, { t: "n", v: 32 }, { t: "n", v: 8 }]
    ];
    const config: GameConfig = { ...baseConfig, width: 4, height: 4 };
    const created = createGame(config, initialGrid).state;
    const oddTurnState = { ...created, turn: 95, over: false };

    expect(oddTurnState.over).toBe(false);
    expect(applyMove(oddTurnState, "left").state.over).toBe(false);
  });
});
