import { applyMove, createGame } from "@/lib/binary2048/engine";
import type { Cell, GameConfig, Tile } from "@/lib/binary2048/types";

const config: GameConfig = {
  width: 2,
  height: 2,
  seed: 431,
  winTile: 2048,
  zeroBehavior: "annihilate",
  spawnOnNoopMove: false,
  spawn: {
    pZero: 0,
    pOne: 1,
    pWildcard: 0,
    pLock: 0,
    wildcardMultipliers: [2]
  }
};

function movePair(left: Tile, right: Tile, turn = 0) {
  const grid: Cell[][] = [
    [left, right],
    [{ t: "n", v: 32 }, { t: "n", v: 64 }]
  ];
  const created = createGame(config, grid).state;
  return applyMove({ ...created, turn, over: false }, "left");
}

function tileCount(grid: Cell[][], type: Tile["t"]) {
  return grid.flat().filter((cell) => cell?.t === type).length;
}

describe("special tile collision matrix", () => {
  it.each([
    {
      name: "zero + number preserves the number",
      left: { t: "z" } as Tile,
      right: { t: "n", v: 8 } as Tile,
      output: { t: "n", v: 8 },
      score: 8
    },
    {
      name: "number + zero preserves the number",
      left: { t: "n", v: 8 } as Tile,
      right: { t: "z" } as Tile,
      output: { t: "n", v: 8 },
      score: 8
    },
    {
      name: "wildcard + number multiplies the number",
      left: { t: "w", m: 2 } as Tile,
      right: { t: "n", v: 8 } as Tile,
      output: { t: "n", v: 16 },
      score: 16
    },
    {
      name: "number + wildcard multiplies the number",
      left: { t: "n", v: 8 } as Tile,
      right: { t: "w", m: 2 } as Tile,
      output: { t: "n", v: 16 },
      score: 16
    },
    {
      name: "matching wildcards combine their multipliers",
      left: { t: "w", m: 2 } as Tile,
      right: { t: "w", m: 2 } as Tile,
      output: { t: "w", m: 4 },
      score: 4
    }
  ])("$name", ({ left, right, output, score }) => {
    const result = movePair(left, right);

    expect(result.moved).toBe(true);
    expect(result.state.grid.flat()).toContainEqual(output);
    expect(result.state.score).toBe(score);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "merge", into: output }));
  });

  it.each([
    ["zero + zero", { t: "z" } as Tile, { t: "z" } as Tile],
    ["zero + wildcard", { t: "z" } as Tile, { t: "w", m: 2 } as Tile],
    ["wildcard + zero", { t: "w", m: 2 } as Tile, { t: "z" } as Tile]
  ])("annihilates %s", (_name, left, right) => {
    const result = movePair(left, right);

    expect(result.moved).toBe(true);
    expect(result.state.score).toBe(0);
    expect(tileCount(result.state.grid, "z")).toBe(0);
    expect(tileCount(result.state.grid, "w")).toBe(0);
    expect(tileCount(result.state.grid, "n")).toBe(3);
  });

  it("does not merge wildcards with different multipliers", () => {
    const result = movePair({ t: "w", m: 2 }, { t: "w", m: 4 });

    expect(result.moved).toBe(false);
    expect(result.state.score).toBe(0);
    expect(tileCount(result.state.grid, "w")).toBe(2);
  });

  it("blocks a lock collision on an even turn", () => {
    const result = movePair({ t: "i" }, { t: "n", v: 8 }, 0);

    expect(result.moved).toBe(false);
    expect(result.events).toContainEqual(expect.objectContaining({ type: "lock_block", turn: 0 }));
    expect(tileCount(result.state.grid, "i")).toBe(1);
  });

  it("breaks a lock as a zero collision on an odd turn", () => {
    const result = movePair({ t: "i" }, { t: "n", v: 8 }, 1);

    expect(result.moved).toBe(true);
    expect(result.state.score).toBe(8);
    expect(result.state.grid.flat()).toContainEqual({ t: "n", v: 8 });
    expect(result.events).toContainEqual(expect.objectContaining({ type: "lock_break", turn: 1 }));
    expect(tileCount(result.state.grid, "i")).toBe(0);
  });
});
