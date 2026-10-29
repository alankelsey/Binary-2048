import { previewDeathByLuckMove } from "@/lib/binary2048/death-by-luck-engine-prototype";
import {
  DEATH_BY_LUCK_RULESET_ID,
  DEATH_BY_LUCK_SCHEMA_VERSION,
  parseDeathByLuckDefinition,
  type DeathByLuckDefinition
} from "@/lib/binary2048/death-by-luck-prototype";
import type { Cell, Coord, Dir, Tile } from "@/lib/binary2048/types";

export type DeathByLuckCoreState = {
  grid: Cell[][];
  turn: number;
  score: number;
  rngStep: number;
  won: boolean;
  over: boolean;
};

export type DeathByLuckGame = {
  version: typeof DEATH_BY_LUCK_SCHEMA_VERSION;
  rulesetId: typeof DEATH_BY_LUCK_RULESET_ID;
  definition: DeathByLuckDefinition;
  initialGrid: Cell[][];
  current: DeathByLuckCoreState;
  moves: Dir[];
  undoStack: DeathByLuckCoreState[];
};

export type DeathByLuckReplay = {
  version: typeof DEATH_BY_LUCK_SCHEMA_VERSION;
  rulesetId: typeof DEATH_BY_LUCK_RULESET_ID;
  kind: "replay";
  definition: DeathByLuckDefinition;
  initialGrid: Cell[][];
  moves: Dir[];
};

export type DeathByLuckRecovery = {
  version: typeof DEATH_BY_LUCK_SCHEMA_VERSION;
  rulesetId: typeof DEATH_BY_LUCK_RULESET_ID;
  kind: "recovery";
  game: DeathByLuckGame;
};

const DIRECTIONS: Dir[] = ["up", "down", "left", "right"];

export function createDeathByLuckGame(definition: DeathByLuckDefinition, initialGrid: Cell[][]): DeathByLuckGame {
  const parsed = parseDeathByLuckDefinition(definition);
  assertGrid(initialGrid, parsed);
  const current = updateTerminal({
    grid: cloneGrid(initialGrid), turn: 0, score: 0, rngStep: 0, won: false, over: false
  }, parsed);
  return {
    version: DEATH_BY_LUCK_SCHEMA_VERSION,
    rulesetId: DEATH_BY_LUCK_RULESET_ID,
    definition: parsed,
    initialGrid: cloneGrid(initialGrid),
    current,
    moves: [],
    undoStack: []
  };
}

export function moveDeathByLuckGame(game: DeathByLuckGame, direction: Dir) {
  assertGame(game);
  if (game.current.over) return { game: cloneGame(game), accepted: false, spawned: null as SpawnedTile };
  const preview = previewDeathByLuckMove(game.definition, game.current.grid, direction, game.current.turn);
  const canSpawnOnNoop = game.definition.config.spawnOnNoopMove && getEmptyCoords(preview.grid).length > 0;
  if (!preview.moved && !canSpawnOnNoop) {
    return { game: cloneGame(game), accepted: false, spawned: null as SpawnedTile };
  }
  const before = cloneCore(game.current);
  let current: DeathByLuckCoreState = {
    grid: preview.grid,
    turn: before.turn + 1,
    score: before.score + preview.gainedScore,
    rngStep: before.rngStep,
    won: before.won,
    over: false
  };
  const spawn = spawnOne(current, game.definition);
  current = updateTerminal(spawn.state, game.definition);
  return {
    game: {
      ...cloneGame(game),
      current,
      moves: [...game.moves, direction],
      undoStack: [...game.undoStack.map(cloneCore), before]
    },
    accepted: true,
    spawned: spawn.spawned
  };
}

export function undoDeathByLuckGame(game: DeathByLuckGame): DeathByLuckGame {
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

export function deathByLuckActionMask(game: DeathByLuckGame): Record<Dir, boolean> {
  if (game.current.over) return { up: false, down: false, left: false, right: false };
  const hasEmpty = getEmptyCoords(game.current.grid).length > 0;
  return Object.fromEntries(DIRECTIONS.map((direction) => {
    const preview = previewDeathByLuckMove(game.definition, game.current.grid, direction, game.current.turn);
    return [direction, preview.moved || (game.definition.config.spawnOnNoopMove && hasEmpty)];
  })) as Record<Dir, boolean>;
}

export function getDeathByLuckLeaderboardEligibility() {
  return { eligible: false as const, reason: "Death by Luck is an experimental unranked ruleset" };
}

export function exportDeathByLuckReplay(game: DeathByLuckGame): DeathByLuckReplay {
  assertGame(game);
  return {
    version: DEATH_BY_LUCK_SCHEMA_VERSION,
    rulesetId: DEATH_BY_LUCK_RULESET_ID,
    kind: "replay",
    definition: parseDeathByLuckDefinition(game.definition),
    initialGrid: cloneGrid(game.initialGrid),
    moves: [...game.moves]
  };
}

export function importDeathByLuckReplay(value: unknown): DeathByLuckGame {
  const replay = value as Partial<DeathByLuckReplay>;
  if (replay?.version !== DEATH_BY_LUCK_SCHEMA_VERSION || replay.rulesetId !== DEATH_BY_LUCK_RULESET_ID ||
      replay.kind !== "replay" || !replay.definition || !Array.isArray(replay.initialGrid) ||
      !Array.isArray(replay.moves) || !replay.moves.every(isDirection)) {
    throw new Error("Invalid Death by Luck replay");
  }
  let game = createDeathByLuckGame(replay.definition, replay.initialGrid);
  for (const direction of replay.moves) game = moveDeathByLuckGame(game, direction).game;
  return game;
}

export function exportDeathByLuckRecovery(game: DeathByLuckGame): DeathByLuckRecovery {
  assertGame(game);
  return {
    version: DEATH_BY_LUCK_SCHEMA_VERSION,
    rulesetId: DEATH_BY_LUCK_RULESET_ID,
    kind: "recovery",
    game: cloneGame(game)
  };
}

export function importDeathByLuckRecovery(value: unknown): DeathByLuckGame {
  const recovery = value as Partial<DeathByLuckRecovery>;
  if (recovery?.version !== DEATH_BY_LUCK_SCHEMA_VERSION || recovery.rulesetId !== DEATH_BY_LUCK_RULESET_ID ||
      recovery.kind !== "recovery" || !recovery.game) throw new Error("Invalid Death by Luck recovery");
  assertGame(recovery.game);
  return cloneGame(recovery.game);
}

type SpawnedTile = { at: Coord; tile: Tile } | null;

function spawnOne(state: DeathByLuckCoreState, definition: DeathByLuckDefinition): {
  state: DeathByLuckCoreState;
  spawned: SpawnedTile;
} {
  const empties = getEmptyCoords(state.grid);
  if (empties.length === 0) return { state: cloneCore(state), spawned: null };
  const seed = definition.config.seed;
  const at = empties[Math.floor(randomUnit(seed, state.rngStep) * empties.length)];
  const roll = randomUnit(seed, state.rngStep + 1);
  const wildcardRoll = randomUnit(seed, state.rngStep + 2);
  const spawn = definition.config.spawn;
  let tile: Tile;
  if (roll < spawn.pZero) tile = { t: "z" };
  else if (roll < spawn.pZero + spawn.pOne) tile = { t: "n", v: 1 };
  else if (roll < spawn.pZero + spawn.pOne + spawn.pWildcard) {
    tile = { t: "w", m: spawn.wildcardMultipliers[Math.floor(wildcardRoll * spawn.wildcardMultipliers.length)] };
  } else tile = { t: "i" };
  const next = cloneCore(state);
  next.rngStep += 3;
  next.grid[at[0]][at[1]] = tile;
  return { state: next, spawned: { at: [...at], tile: { ...tile } } };
}

function updateTerminal(state: DeathByLuckCoreState, definition: DeathByLuckDefinition): DeathByLuckCoreState {
  const next = cloneCore(state);
  next.won ||= next.grid.flat().some((cell) => cell?.t === "n" && cell.v >= definition.config.winTile);
  if (getEmptyCoords(next.grid).length === 0) {
    const shell: DeathByLuckGame = {
      version: DEATH_BY_LUCK_SCHEMA_VERSION,
      rulesetId: DEATH_BY_LUCK_RULESET_ID,
      definition,
      initialGrid: next.grid,
      current: { ...next, over: false },
      moves: [],
      undoStack: []
    };
    next.over = !Object.values(deathByLuckActionMask(shell)).some(Boolean);
  } else next.over = false;
  return next;
}

function assertGame(game: DeathByLuckGame) {
  if (game?.version !== DEATH_BY_LUCK_SCHEMA_VERSION || game.rulesetId !== DEATH_BY_LUCK_RULESET_ID ||
      !game.definition || !game.current || !Array.isArray(game.initialGrid) || !Array.isArray(game.moves) ||
      !Array.isArray(game.undoStack)) throw new Error("Invalid Death by Luck game");
  parseDeathByLuckDefinition(game.definition);
  assertGrid(game.current.grid, game.definition);
}

function assertGrid(grid: Cell[][], definition: DeathByLuckDefinition) {
  if (grid.length !== definition.config.height || grid.some((row) => row.length !== definition.config.width)) {
    throw new Error("Death by Luck grid dimensions must match its definition");
  }
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

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map((cell) => cell === null ? null : { ...cell }));
}

function cloneCore(state: DeathByLuckCoreState): DeathByLuckCoreState {
  return { ...state, grid: cloneGrid(state.grid) };
}

function cloneGame(game: DeathByLuckGame): DeathByLuckGame {
  return {
    ...game,
    definition: parseDeathByLuckDefinition(game.definition),
    initialGrid: cloneGrid(game.initialGrid),
    current: cloneCore(game.current),
    moves: [...game.moves],
    undoStack: game.undoStack.map(cloneCore)
  };
}
