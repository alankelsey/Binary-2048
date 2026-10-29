import { resolveDeathByLuckLine } from "@/lib/binary2048/death-by-luck-engine-prototype";
import {
  createDeathByLuckGame,
  deathByLuckActionMask,
  exportDeathByLuckRecovery,
  exportDeathByLuckReplay,
  getDeathByLuckLeaderboardEligibility,
  importDeathByLuckRecovery,
  importDeathByLuckReplay,
  moveDeathByLuckGame,
  undoDeathByLuckGame
} from "@/lib/binary2048/death-by-luck-game-prototype";
import { createDeathByLuckDefinition } from "@/lib/binary2048/death-by-luck-prototype";
import type { Cell, Dir } from "@/lib/binary2048/types";

const n = (value: number) => ({ t: "n" as const, v: value });
const w = (multiplier: number) => ({ t: "w" as const, m: multiplier });
const zero = { t: "z" as const };
const lock = { t: "i" as const };
const empty = null;

function definition(seed = 9200, width = 4, height = 2, winTile = 2048) {
  return createDeathByLuckDefinition(seed, {
    width,
    height,
    winTile,
    spawn: { pZero: 0, pOne: 0.5, pWildcard: 0.5, pLock: 0, wildcardMultipliers: [2, 4] }
  });
}

function play(grid: Cell[][], moves: Dir[], seed = 9200) {
  let game = createDeathByLuckGame(definition(seed, grid[0].length, grid.length), grid);
  for (const direction of moves) game = moveDeathByLuckGame(game, direction).game;
  return game;
}

describe("Death by Luck integrated interaction prototype", () => {
  it("defines zero interactions and their scoring", () => {
    const mode = definition();
    expect(resolveDeathByLuckLine(mode, [zero, n(8), empty, empty])).toEqual({
      line: [n(8), empty, empty, empty], moved: true, gainedScore: 8
    });
    expect(resolveDeathByLuckLine(mode, [zero, w(2), empty, empty])).toEqual({
      line: [empty, empty, empty, empty], moved: true, gainedScore: 0
    });
    expect(resolveDeathByLuckLine(mode, [zero, zero, empty, empty])).toEqual({
      line: [empty, empty, empty, empty], moved: true, gainedScore: 0
    });
  });

  it("retains V1 Lock-0 sliding and global parity behavior", () => {
    const mode = definition();
    expect(resolveDeathByLuckLine(mode, [lock, n(8), empty, empty], 0)).toEqual({
      line: [lock, n(8), empty, empty], moved: false, gainedScore: 0
    });
    expect(resolveDeathByLuckLine(mode, [lock, n(8), empty, empty], 1)).toEqual({
      line: [n(8), empty, empty, empty], moved: true, gainedScore: 8
    });
  });

  it("scores multiplication, detects a fast win, and preserves wildcard blocking", () => {
    const mode = definition(9201, 4, 2, 16);
    const game = createDeathByLuckGame(mode, [
      [w(2), n(8), empty, empty],
      [w(2), w(2), empty, empty]
    ]);
    const moved = moveDeathByLuckGame(game, "left");

    expect(moved.game.current.score).toBe(16);
    expect(moved.game.current.won).toBe(true);
    expect(moved.game.current.grid[1].filter((cell) => cell?.t === "w")).toHaveLength(2);
  });

  it("marks a full wildcard-only board terminal and returns an empty action mask", () => {
    const mode = definition(9202, 2, 2);
    const game = createDeathByLuckGame(mode, [[w(2), w(2)], [w(4), w(4)]]);

    expect(game.current.over).toBe(true);
    expect(deathByLuckActionMask(game)).toEqual({ up: false, down: false, left: false, right: false });
  });

  it("uses the same action mask for simulation and playable move detection", () => {
    const mode = definition(9203, 2, 2);
    const game = createDeathByLuckGame(mode, [[w(2), n(2)], [empty, empty]]);
    const mask = deathByLuckActionMask(game);

    expect(mask.left).toBe(true);
    expect(mask.down).toBe(true);
    for (const direction of ["up", "down", "left", "right"] as Dir[]) {
      expect(moveDeathByLuckGame(game, direction).accepted).toBe(mask[direction]);
    }
  });

  it("undo restores score, turn, grid, RNG, and terminal state", () => {
    const mode = definition(9204, 2, 2, 4);
    const game = createDeathByLuckGame(mode, [[n(2), n(2)], [empty, empty]]);
    const moved = moveDeathByLuckGame(game, "left").game;
    const undone = undoDeathByLuckGame(moved);

    expect(undone.current).toEqual(game.current);
    expect(undone.moves).toEqual([]);
  });

  it("round trips deterministic replay and direct recovery", () => {
    const game = play([[w(2), n(2)], [empty, empty]], ["left", "down"], 9205);
    const replayed = importDeathByLuckReplay(JSON.parse(JSON.stringify(exportDeathByLuckReplay(game))));
    const recovered = importDeathByLuckRecovery(JSON.parse(JSON.stringify(exportDeathByLuckRecovery(game))));

    expect(replayed.current).toEqual(game.current);
    expect(recovered).toEqual(game);
  });

  it("produces identical spawns for identical seeds and accepted moves", () => {
    const first = play([[n(2), empty], [empty, empty]], ["right", "down"], 9206);
    const second = play([[n(2), empty], [empty, empty]], ["right", "down"], 9206);

    expect(first.current).toEqual(second.current);
    expect(first.moves).toEqual(second.moves);
  });

  it("is always excluded from ranked leaderboards", () => {
    expect(getDeathByLuckLeaderboardEligibility()).toEqual({
      eligible: false,
      reason: "Death by Luck is an experimental unranked ruleset"
    });
  });
});
