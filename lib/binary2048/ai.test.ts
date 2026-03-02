import {
  ACTION_SPACE,
  actionMask,
  encodeCell,
  encodeState,
  flattenEncodedState,
  legalActionCodes,
  legalMoves,
  stateHash
} from "@/lib/binary2048/ai";
import { createGame } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("AI helpers", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 11,
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

  it("encodes cells by tile type and bounded exponent values", () => {
    expect(encodeCell(null)).toEqual({ type: 0, value: 0 });
    expect(encodeCell({ t: "z" })).toEqual({ type: 1, value: 0 });
    expect(encodeCell({ t: "n", v: 8 })).toEqual({ type: 2, value: 3 });
    expect(encodeCell({ t: "w", m: 4 })).toEqual({ type: 3, value: 2 });
  });

  it("encodes a full grid", () => {
    const grid: Cell[][] = [
      [{ t: "n", v: 1 }, null, null, null],
      [null, { t: "z" }, null, null],
      [null, null, { t: "w", m: 2 }, null],
      [null, null, null, { t: "n", v: 16 }]
    ];

    const encoded = encodeState({ grid });
    expect(encoded[0][0]).toEqual({ type: 2, value: 0 });
    expect(encoded[1][1]).toEqual({ type: 1, value: 0 });
    expect(encoded[2][2]).toEqual({ type: 3, value: 1 });
    expect(encoded[3][3]).toEqual({ type: 2, value: 4 });
  });

  it("computes legal moves that change board state", () => {
    const initialGrid: Cell[][] = [
      [{ t: "n", v: 1 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, { t: "n", v: 1 }]
    ];
    const { state } = createGame(config, initialGrid);
    const moves = legalMoves(state);
    expect(moves).toEqual(expect.arrayContaining(["up", "down", "left", "right"]));
    const actions = legalActionCodes(state);
    expect(actions).toEqual(expect.arrayContaining(["U", "D", "L", "R"]));
  });

  it("exposes stable action space and flattened encoding", () => {
    expect(ACTION_SPACE).toEqual(["L", "R", "U", "D"]);
    const grid: Cell[][] = [[{ t: "n", v: 1 }]];
    const flat = flattenEncodedState(encodeState({ grid }));
    expect(flat).toEqual([2, 0]);
  });

  it("produces deterministic state hashes", () => {
    const base = {
      grid: [[{ t: "n", v: 1 }] as Cell[]],
      turn: 3,
      score: 12,
      rngStep: 9
    };
    expect(stateHash(base)).toBe(stateHash(base));
    expect(stateHash({ ...base, turn: 4 })).not.toBe(stateHash(base));
  });

  it("provides fixed-order action masks aligned to action space", () => {
    expect(actionMask(["L", "U"])).toEqual([1, 0, 1, 0]);
    expect(actionMask(["R", "D"])).toEqual([0, 1, 0, 1]);
  });
});
