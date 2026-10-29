import {
  ANCHORED_LOCK_RULESET_ID,
  anchoredLockActionMask,
  createAnchoredLockGame,
  exportAnchoredLockRecovery,
  exportAnchoredLockReplay,
  importAnchoredLockRecovery,
  importAnchoredLockReplay,
  moveAnchoredLockGame,
  undoAnchoredLockGame,
  type AnchoredLockGameConfig
} from "@/lib/binary2048/anchored-lock-game-prototype";
import type { Cell, Dir } from "@/lib/binary2048/types";

const n = (value: number) => ({ t: "n" as const, v: value });
const lock = { t: "i" as const };
const empty = null;
const noSpawn = { spawnAfterAcceptedMove: false };

function play(grid: Cell[][], moves: Dir[], config: Partial<AnchoredLockGameConfig> = noSpawn) {
  let game = createAnchoredLockGame(grid, config);
  for (const move of moves) game = moveAnchoredLockGame(game, move).game;
  return game;
}

describe("anchored Lock-0 integrated game prototype", () => {
  it("covers tiles on both sides, multiple locks, and adjacent segment merges", () => {
    const game = play([
      [n(2), n(2), lock, n(4), n(4), lock, n(8), n(8)]
    ], ["left"]);

    expect(game.current.grid).toEqual([
      [n(4), empty, lock, n(8), empty, lock, n(16), empty]
    ]);
    expect(game.current.score).toBe(28);
    expect(game.current.lockCollisions).toEqual({ "0:2": 1, "0:5": 1 });
  });

  it("treats collision-only lifecycle progress as a turn but a pure no-op as no turn", () => {
    const collision = createAnchoredLockGame([[empty, lock, n(2)]], noSpawn);
    const first = moveAnchoredLockGame(collision, "left");
    const second = moveAnchoredLockGame(first.game, "left");
    expect(first.accepted).toBe(true);
    expect(first.game.current.turn).toBe(1);
    expect(second.accepted).toBe(true);
    expect(second.game.current.turn).toBe(2);

    const noOp = createAnchoredLockGame([[n(2), empty, empty]], noSpawn);
    const unchanged = moveAnchoredLockGame(noOp, "left");
    expect(unchanged.accepted).toBe(false);
    expect(unchanged.game.current.turn).toBe(0);
  });

  it("spawns after accepted state changes and consumes a fixed three RNG draws", () => {
    const game = createAnchoredLockGame([[n(2), empty], [empty, empty]], {
      seed: 99,
      spawnAfterAcceptedMove: true,
      spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
    });
    const moved = moveAnchoredLockGame(game, "right");

    expect(moved.accepted).toBe(true);
    expect(moved.spawned).not.toBeNull();
    expect(moved.game.current.rngStep).toBe(3);
    expect(moved.game.current.grid.flat().filter(Boolean)).toHaveLength(2);
  });

  it("honors configured spawn-on-no-op semantics", () => {
    const game = createAnchoredLockGame([[n(2), empty]], {
      seed: 100,
      spawnOnNoopMove: true,
      spawnAfterAcceptedMove: true,
      spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
    });
    const result = moveAnchoredLockGame(game, "left");

    expect(result.accepted).toBe(true);
    expect(result.game.current.turn).toBe(1);
    expect(result.spawned).not.toBeNull();
  });

  it("undo restores grid, lock lifecycle, score, turn, and RNG state", () => {
    const game = createAnchoredLockGame([[empty, lock, empty, n(2)]], { ...noSpawn, seed: 101 });
    const moved = moveAnchoredLockGame(game, "left").game;
    const undone = undoAnchoredLockGame(moved);

    expect(undone.current).toEqual(game.current);
    expect(undone.moves).toEqual([]);
    expect(undone.undoStack).toEqual([]);
  });

  it("detects wins and terminal full boards under anchored action semantics", () => {
    const won = play([[n(8), n(8)]], ["left"], { ...noSpawn, winTile: 16 });
    expect(won.current.won).toBe(true);

    const over = createAnchoredLockGame([
      [n(2), n(4)],
      [n(8), n(16)]
    ], noSpawn);
    expect(over.current.over).toBe(true);
    expect(anchoredLockActionMask(over)).toEqual({ up: false, down: false, left: false, right: false });
  });

  it("keeps collision actions available in simulation masks on a full board", () => {
    const game = createAnchoredLockGame([[n(2), lock, n(4)]], noSpawn);
    expect(anchoredLockActionMask(game)).toEqual({
      up: false,
      down: false,
      left: true,
      right: true
    });
    expect(game.current.over).toBe(false);
  });

  it("round trips versioned replay export/import to the same deterministic state", () => {
    const game = play([[empty, lock, empty, n(2)]], ["left", "left", "left"], noSpawn);
    const replay = JSON.parse(JSON.stringify(exportAnchoredLockReplay(game)));
    expect(replay.rulesetId).toBe(ANCHORED_LOCK_RULESET_ID);
    const imported = importAnchoredLockReplay(replay);

    expect(imported.current).toEqual(game.current);
    expect(imported.moves).toEqual(game.moves);
  });

  it("rejects V1 or missing ruleset identities instead of reinterpreting them", () => {
    const game = createAnchoredLockGame([[n(2), empty]], noSpawn);
    const replay = exportAnchoredLockReplay(game);

    expect(() => importAnchoredLockReplay({ ...replay, rulesetId: "binary2048-v1" })).toThrow(
      "Invalid anchored-lock replay"
    );
    const missingRuleset: Partial<typeof replay> = { ...replay };
    delete missingRuleset.rulesetId;
    expect(() => importAnchoredLockReplay(missingRuleset)).toThrow("Invalid anchored-lock replay");
  });

  it("emits coordinate-bound collision and post-resolution removal events", () => {
    const initial = createAnchoredLockGame([[empty, lock, n(2)]], noSpawn);
    const first = moveAnchoredLockGame(initial, "left");
    expect(first.events).toEqual([
      { type: "lock_collision", at: [0, 1], collisionCount: 1 }
    ]);

    const second = moveAnchoredLockGame(first.game, "left");
    expect(second.events).toEqual([
      { type: "lock_collision", at: [0, 1], collisionCount: 2 },
      { type: "lock_removed", at: [0, 1], collisionCount: 2 }
    ]);
  });

  it("round trips recovery with lifecycle and undo state intact", () => {
    const game = moveAnchoredLockGame(
      createAnchoredLockGame([[empty, lock, empty, n(2)]], noSpawn),
      "left"
    ).game;
    const recovered = importAnchoredLockRecovery(JSON.parse(JSON.stringify(exportAnchoredLockRecovery(game))));

    expect(recovered).toEqual(game);
    expect(undoAnchoredLockGame(recovered).current.grid).toEqual([[empty, lock, empty, n(2)]]);
  });

  it("uses deterministic spawning for identical seeds and move sequences", () => {
    const config = {
      seed: 777,
      spawnAfterAcceptedMove: true,
      spawn: { pZero: 0.2, pOne: 0.5, pWildcard: 0.2, pLock: 0.1, wildcardMultipliers: [2, 4] }
    };
    const first = play([[n(2), empty], [empty, empty]], ["right", "down"], config);
    const second = play([[n(2), empty], [empty, empty]], ["right", "down"], config);

    expect(first.current).toEqual(second.current);
    expect(first.moves).toEqual(second.moves);
  });
});
