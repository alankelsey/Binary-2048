import {
  advanceAnchoredLockLifecycle,
  createAnchoredLockPrototypeState,
  type AnchoredLockPrototypeState
} from "@/lib/binary2048/anchored-lock-prototype";
import type { Cell, Coord, Dir, SpawnConfig, Tile } from "@/lib/binary2048/types";

export const ANCHORED_LOCK_GAME_VERSION = "anchored-lock-prototype-v1" as const;
export const ANCHORED_LOCK_RULESET_ID = "binary2048-v2-anchored-locks" as const;

export type AnchoredLockEvent =
  | { type: "lock_collision"; at: Coord; collisionCount: number }
  | { type: "lock_removed"; at: Coord; collisionCount: number };

export type AnchoredLockGameConfig = {
  seed: number;
  winTile: number;
  spawnOnNoopMove: boolean;
  spawnAfterAcceptedMove: boolean;
  spawn: SpawnConfig;
};

export type AnchoredLockCoreState = AnchoredLockPrototypeState & {
  turn: number;
  score: number;
  rngStep: number;
  won: boolean;
  over: boolean;
};

export type AnchoredLockGame = {
  version: typeof ANCHORED_LOCK_GAME_VERSION;
  rulesetId: typeof ANCHORED_LOCK_RULESET_ID;
  config: AnchoredLockGameConfig;
  initialGrid: Cell[][];
  current: AnchoredLockCoreState;
  moves: Dir[];
  undoStack: AnchoredLockCoreState[];
};

export type AnchoredLockGameMove = {
  game: AnchoredLockGame;
  accepted: boolean;
  spawned: { at: Coord; tile: Tile } | null;
  collisions: Coord[];
  removedLocks: Coord[];
  events: AnchoredLockEvent[];
};

export type AnchoredLockReplay = {
  version: typeof ANCHORED_LOCK_GAME_VERSION;
  rulesetId: typeof ANCHORED_LOCK_RULESET_ID;
  kind: "replay";
  config: AnchoredLockGameConfig;
  initialGrid: Cell[][];
  moves: Dir[];
};

export type AnchoredLockRecovery = {
  version: typeof ANCHORED_LOCK_GAME_VERSION;
  rulesetId: typeof ANCHORED_LOCK_RULESET_ID;
  kind: "recovery";
  game: AnchoredLockGame;
};

const DIRECTIONS: Dir[] = ["up", "down", "left", "right"];

export function createAnchoredLockGame(
  grid: Cell[][],
  config: Partial<AnchoredLockGameConfig> = {}
): AnchoredLockGame {
  const resolvedConfig: AnchoredLockGameConfig = {
    seed: config.seed ?? 42,
    winTile: config.winTile ?? 2048,
    spawnOnNoopMove: config.spawnOnNoopMove ?? false,
    spawnAfterAcceptedMove: config.spawnAfterAcceptedMove ?? true,
    spawn: {
      pZero: config.spawn?.pZero ?? 0.15,
      pOne: config.spawn?.pOne ?? 0.72,
      pWildcard: config.spawn?.pWildcard ?? 0.1,
      pLock: config.spawn?.pLock ?? 0.03,
      wildcardMultipliers: [...(config.spawn?.wildcardMultipliers ?? [2, 4, 8])]
    }
  };
  validateConfig(resolvedConfig);
  const lifecycle = createAnchoredLockPrototypeState(grid);
  const current = updateTerminal({ ...lifecycle, turn: 0, score: 0, rngStep: 0, won: false, over: false }, resolvedConfig);
  return {
    version: ANCHORED_LOCK_GAME_VERSION,
    rulesetId: ANCHORED_LOCK_RULESET_ID,
    config: cloneConfig(resolvedConfig),
    initialGrid: cloneGrid(grid),
    current,
    moves: [],
    undoStack: []
  };
}

export function moveAnchoredLockGame(game: AnchoredLockGame, direction: Dir): AnchoredLockGameMove {
  assertGame(game);
  if (game.current.over) return { game: cloneGame(game), accepted: false, spawned: null, collisions: [], removedLocks: [], events: [] };
  const lifecycle = advanceAnchoredLockLifecycle(game.current, direction);
  const emptyCount = getEmptyCoords(lifecycle.state.grid).length;
  const accepted = lifecycle.gridChanged || lifecycle.collisions.length > 0 ||
    (game.config.spawnOnNoopMove && emptyCount > 0);
  if (!accepted) {
    const unchanged = cloneGame(game);
    unchanged.current = updateTerminal(unchanged.current, unchanged.config);
    return { game: unchanged, accepted: false, spawned: null, collisions: [], removedLocks: [], events: [] };
  }

  const before = cloneCore(game.current);
  let current: AnchoredLockCoreState = {
    ...lifecycle.state,
    turn: before.turn + 1,
    score: before.score + lifecycle.gainedScore,
    rngStep: before.rngStep,
    won: before.won,
    over: false
  };
  let spawned: AnchoredLockGameMove["spawned"] = null;
  if (game.config.spawnAfterAcceptedMove) {
    const spawn = spawnOne(current, game.config);
    current = spawn.state;
    spawned = spawn.spawned;
  }
  current = updateTerminal(current, game.config);
  const removedKeys = new Set(lifecycle.removedLocks.map(coordinateKey));
  const events: AnchoredLockEvent[] = lifecycle.collisions.flatMap((at) => {
    const collisionCount = (before.lockCollisions[coordinateKey(at)] ?? 0) + 1;
    const collision: AnchoredLockEvent = { type: "lock_collision", at: [...at], collisionCount };
    return removedKeys.has(coordinateKey(at))
      ? [collision, { type: "lock_removed", at: [...at], collisionCount }]
      : [collision];
  });
  return {
    game: {
      ...cloneGame(game),
      current,
      moves: [...game.moves, direction],
      undoStack: [...game.undoStack.map(cloneCore), before]
    },
    accepted: true,
    spawned,
    collisions: lifecycle.collisions,
    removedLocks: lifecycle.removedLocks,
    events
  };
}

export function undoAnchoredLockGame(game: AnchoredLockGame): AnchoredLockGame {
  assertGame(game);
  const previous = game.undoStack.at(-1);
  if (!previous) return cloneGame(game);
  return {
    ...cloneGame(game),
    current: cloneCore(previous),
    moves: game.moves.slice(0, -1),
    undoStack: game.undoStack.slice(0, -1).map(cloneCore)
  };
}

export function anchoredLockActionMask(game: AnchoredLockGame): Record<Dir, boolean> {
  if (game.current.over) return { up: false, down: false, left: false, right: false };
  const hasEmpty = getEmptyCoords(game.current.grid).length > 0;
  return Object.fromEntries(DIRECTIONS.map((direction) => {
    const result = advanceAnchoredLockLifecycle(game.current, direction);
    return [direction, result.gridChanged || result.collisions.length > 0 || (game.config.spawnOnNoopMove && hasEmpty)];
  })) as Record<Dir, boolean>;
}

export function exportAnchoredLockReplay(game: AnchoredLockGame): AnchoredLockReplay {
  assertGame(game);
  return {
    version: ANCHORED_LOCK_GAME_VERSION,
    rulesetId: ANCHORED_LOCK_RULESET_ID,
    kind: "replay",
    config: cloneConfig(game.config),
    initialGrid: cloneGrid(game.initialGrid),
    moves: [...game.moves]
  };
}

export function importAnchoredLockReplay(value: unknown): AnchoredLockGame {
  const replay = value as Partial<AnchoredLockReplay>;
  if (replay?.version !== ANCHORED_LOCK_GAME_VERSION || replay.rulesetId !== ANCHORED_LOCK_RULESET_ID || replay.kind !== "replay" ||
      !replay.config || !Array.isArray(replay.initialGrid) || !Array.isArray(replay.moves) ||
      !replay.moves.every(isDirection)) {
    throw new Error("Invalid anchored-lock replay");
  }
  let game = createAnchoredLockGame(replay.initialGrid, replay.config);
  for (const direction of replay.moves) game = moveAnchoredLockGame(game, direction).game;
  return game;
}

export function exportAnchoredLockRecovery(game: AnchoredLockGame): AnchoredLockRecovery {
  assertGame(game);
  return {
    version: ANCHORED_LOCK_GAME_VERSION,
    rulesetId: ANCHORED_LOCK_RULESET_ID,
    kind: "recovery",
    game: cloneGame(game)
  };
}

export function importAnchoredLockRecovery(value: unknown): AnchoredLockGame {
  const recovery = value as Partial<AnchoredLockRecovery>;
  if (recovery?.version !== ANCHORED_LOCK_GAME_VERSION || recovery.rulesetId !== ANCHORED_LOCK_RULESET_ID ||
      recovery.kind !== "recovery" || !recovery.game) {
    throw new Error("Invalid anchored-lock recovery");
  }
  assertGame(recovery.game);
  return cloneGame(recovery.game);
}

function spawnOne(state: AnchoredLockCoreState, config: AnchoredLockGameConfig) {
  const empties = getEmptyCoords(state.grid);
  if (empties.length === 0) return { state: cloneCore(state), spawned: null };
  const positionRoll = randomUnit(config.seed, state.rngStep);
  const tileRoll = randomUnit(config.seed, state.rngStep + 1);
  const wildcardRoll = randomUnit(config.seed, state.rngStep + 2);
  const at = empties[Math.floor(positionRoll * empties.length)];
  const tile = sampleTile(tileRoll, wildcardRoll, config.spawn);
  const next = cloneCore(state);
  next.rngStep += 3;
  next.grid[at[0]][at[1]] = tile;
  if (tile.t === "i") next.lockCollisions[coordinateKey(at)] = 0;
  return { state: next, spawned: { at: [...at] as Coord, tile: { ...tile } } };
}

function sampleTile(roll: number, wildcardRoll: number, spawn: SpawnConfig): Tile {
  if (roll < spawn.pZero) return { t: "z" };
  if (roll < spawn.pZero + spawn.pOne) return { t: "n", v: 1 };
  if (roll < spawn.pZero + spawn.pOne + spawn.pWildcard) {
    return { t: "w", m: spawn.wildcardMultipliers[Math.floor(wildcardRoll * spawn.wildcardMultipliers.length)] };
  }
  return { t: "i" };
}

function updateTerminal(state: AnchoredLockCoreState, config: AnchoredLockGameConfig): AnchoredLockCoreState {
  const next = cloneCore(state);
  next.won ||= next.grid.flat().some((cell) => cell?.t === "n" && cell.v >= config.winTile);
  if (getEmptyCoords(next.grid).length === 0) {
    const shell: AnchoredLockGame = {
      version: ANCHORED_LOCK_GAME_VERSION,
      rulesetId: ANCHORED_LOCK_RULESET_ID,
      config,
      initialGrid: next.grid,
      current: { ...next, over: false },
      moves: [],
      undoStack: []
    };
    next.over = !Object.values(anchoredLockActionMask(shell)).some(Boolean);
  } else {
    next.over = false;
  }
  return next;
}

function validateConfig(config: AnchoredLockGameConfig) {
  if (!Number.isSafeInteger(config.seed) || config.seed < 1) throw new Error("Prototype seed must be positive");
  const total = config.spawn.pZero + config.spawn.pOne + config.spawn.pWildcard + config.spawn.pLock;
  if (Math.abs(total - 1) > 1e-6) throw new Error("Prototype spawn probabilities must total 1");
  if (config.spawn.wildcardMultipliers.length === 0) throw new Error("Prototype wildcard multipliers required");
}

function assertGame(game: AnchoredLockGame) {
  if (game?.version !== ANCHORED_LOCK_GAME_VERSION || game.rulesetId !== ANCHORED_LOCK_RULESET_ID ||
      !game.config || !game.current ||
      !Array.isArray(game.initialGrid) || !Array.isArray(game.moves) || !Array.isArray(game.undoStack)) {
    throw new Error("Invalid anchored-lock prototype game");
  }
  createAnchoredLockPrototypeState(game.current.grid);
  validateConfig(game.config);
}

function getEmptyCoords(grid: Cell[][]): Coord[] {
  return grid.flatMap((row, rowIndex) => row.flatMap((cell, columnIndex) =>
    cell === null ? [[rowIndex, columnIndex] as Coord] : []
  ));
}

function randomUnit(seed: number, step: number): number {
  let value = (seed ^ (Math.imul(step + 1, 747796405) + 2891336453)) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  value = Math.imul(value, 2246822519) >>> 0;
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 3266489917) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return value / 4294967296;
}

function isDirection(value: unknown): value is Dir {
  return typeof value === "string" && DIRECTIONS.includes(value as Dir);
}

function coordinateKey(coord: Coord): string {
  return `${coord[0]}:${coord[1]}`;
}

function cloneConfig(config: AnchoredLockGameConfig): AnchoredLockGameConfig {
  return { ...config, spawn: { ...config.spawn, wildcardMultipliers: [...config.spawn.wildcardMultipliers] } };
}

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map((cell) => cell === null ? null : { ...cell }));
}

function cloneCore(state: AnchoredLockCoreState): AnchoredLockCoreState {
  return { ...state, grid: cloneGrid(state.grid), lockCollisions: { ...state.lockCollisions } };
}

function cloneGame(game: AnchoredLockGame): AnchoredLockGame {
  return {
    ...game,
    config: cloneConfig(game.config),
    initialGrid: cloneGrid(game.initialGrid),
    current: cloneCore(game.current),
    moves: [...game.moves],
    undoStack: game.undoStack.map(cloneCore)
  };
}
