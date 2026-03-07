import { parseAction, toActionCode, type ActionCode } from "@/lib/binary2048/action";
import { legalActionCodes } from "@/lib/binary2048/ai";
import { applyMove, createGame, DEFAULT_CONFIG, runScenario } from "@/lib/binary2048/engine";
import { toCompactReplayPayload } from "@/lib/binary2048/replay-format";
import type { Cell, Dir, GameConfig } from "@/lib/binary2048/types";

export type GhostRaceChallenge = {
  challengeId: string;
  seed: number;
  bot: "rollout";
  maxMoves: number;
  config: GameConfig;
  initialGrid: Cell[][];
  ghost: {
    moves: ActionCode[];
    score: number;
    maxTile: number;
    turns: number;
  };
};

export type GhostRaceSubmission = {
  challengeId: string;
  playerId: string;
  score: number;
  maxTile: number;
  turns: number;
  beatGhost: boolean;
  tiedGhost: boolean;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_ghost_race_entries?: GhostRaceSubmission[];
};

const entries = globalStore.__binary2048_ghost_race_entries ?? [];
globalStore.__binary2048_ghost_race_entries = entries;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function countEmptyCells(grid: Cell[][]) {
  let empty = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === null) empty += 1;
    }
  }
  return empty;
}

function getMaxTile(grid: Cell[][]) {
  let max = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell?.t === "n") max = Math.max(max, cell.v);
    }
  }
  return max;
}

function evaluateStateScore(state: { grid: Cell[][]; score: number; over: boolean }) {
  const terminalPenalty = state.over ? -1200 : 0;
  return state.score + getMaxTile(state.grid) * 12 + countEmptyCells(state.grid) * 8 + terminalPenalty;
}

function rolloutValue(start: ReturnType<typeof createGame>["state"], rand: () => number, depth: number) {
  let current = start;
  for (let i = 0; i < depth && !current.over && !current.won; i++) {
    const legal = legalActionCodes(current);
    if (legal.length === 0) break;
    const action = legal[Math.floor(rand() * legal.length)];
    const dir = parseAction(action) as Dir | null;
    if (!dir) break;
    current = applyMove(current, dir).state;
  }
  return evaluateStateScore(current);
}

function pickRolloutMove(state: ReturnType<typeof createGame>["state"], rand: () => number) {
  const legal = legalActionCodes(state);
  if (legal.length === 0) return null;
  const rolloutsPerAction = 6;
  const rolloutDepth = 10;
  let bestAction: ActionCode | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of legal) {
    const dir = parseAction(action) as Dir | null;
    if (!dir) continue;
    const next = applyMove(state, dir).state;
    let total = evaluateStateScore(next);
    for (let i = 0; i < rolloutsPerAction; i++) {
      total += rolloutValue(next, rand, rolloutDepth);
    }
    const avg = total / (rolloutsPerAction + 1);
    if (avg > bestScore) {
      bestScore = avg;
      bestAction = action;
    }
  }
  return bestAction;
}

function mergeConfig(seed: number, config?: Partial<GameConfig>): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    ...(config ?? {}),
    seed,
    spawn: {
      ...DEFAULT_CONFIG.spawn,
      ...(config?.spawn ?? {})
    }
  };
}

export function buildGhostRaceChallenge(seed: number, maxMoves = 250, config?: Partial<GameConfig>): GhostRaceChallenge {
  const merged = mergeConfig(seed, config);
  const game = createGame(merged);
  let current = game.state;
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const moves: ActionCode[] = [];
  while (!current.over && !current.won && moves.length < maxMoves) {
    const action = pickRolloutMove(current, rand);
    if (!action) break;
    const dir = parseAction(action) as Dir | null;
    if (!dir) break;
    current = applyMove(current, dir).state;
    moves.push(action);
  }
  return {
    challengeId: `ghost_${seed}`,
    seed,
    bot: "rollout",
    maxMoves,
    config: merged,
    initialGrid: game.state.grid,
    ghost: {
      moves,
      score: current.score,
      maxTile: getMaxTile(current.grid),
      turns: current.turn
    }
  };
}

export function submitGhostRaceReplay(playerId: string, payload: unknown): GhostRaceSubmission {
  if (!playerId || playerId.trim().length < 2) {
    throw new Error("playerId is required");
  }
  const compact = toCompactReplayPayload(payload);
  const challenge = buildGhostRaceChallenge(compact.header.seed);
  const moves = compact.moves.map((move) => parseAction(move)).filter((dir): dir is Dir => dir !== null);
  const run = runScenario(challenge.config, challenge.initialGrid, moves);
  const score = run.final.score;
  const maxTile = getMaxTile(run.final.grid);
  const turns = run.final.turn;
  const beatGhost = score > challenge.ghost.score || (score === challenge.ghost.score && maxTile > challenge.ghost.maxTile);
  const tiedGhost = score === challenge.ghost.score && maxTile === challenge.ghost.maxTile && turns === challenge.ghost.turns;
  const submitted: GhostRaceSubmission = {
    challengeId: challenge.challengeId,
    playerId: playerId.trim(),
    score,
    maxTile,
    turns,
    beatGhost,
    tiedGhost
  };
  entries.unshift(submitted);
  return submitted;
}

export function listGhostRaceSubmissions(limit = 20) {
  const safe = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  return entries.slice(0, safe);
}

export function resetGhostRaceStore() {
  entries.length = 0;
}
