import { createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import { simulateBatch } from "@/lib/binary2048/simulate";
import { parseAction } from "@/lib/binary2048/action";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

export type AsyncMatchSubmission = {
  playerId: string;
  moves: Array<"left" | "right" | "up" | "down">;
  score: number;
  maxTile: number;
  movesApplied: number;
  submittedAtISO: string;
};

export type AsyncSameSeedMatch = {
  id: string;
  createdBy: string;
  players: string[];
  seed: number;
  config: GameConfig;
  initialGrid: Cell[][];
  status: "open" | "complete";
  createdAtISO: string;
  submissions: AsyncMatchSubmission[];
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_async_matches?: Map<string, AsyncSameSeedMatch>;
  __binary2048_async_match_id?: number;
};

const matches = globalStore.__binary2048_async_matches ?? new Map<string, AsyncSameSeedMatch>();
let idCounter = globalStore.__binary2048_async_match_id ?? 1;
globalStore.__binary2048_async_matches = matches;
globalStore.__binary2048_async_match_id = idCounter;

function randomSeed() {
  return Math.floor(Math.random() * 2147483647) + 1;
}

function mergeConfig(config: Partial<GameConfig> | undefined, seed: number): GameConfig {
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

function maxTile(grid: Cell[][]): number {
  let max = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell?.t === "n") max = Math.max(max, cell.v);
    }
  }
  return max;
}

function createInitialGrid(config: GameConfig): Cell[][] {
  return createGame(config).state.grid;
}

export function createAsyncSameSeedMatch(input: {
  createdBy: string;
  opponentId?: string;
  seed?: number;
  config?: Partial<GameConfig>;
}) {
  const seed = typeof input.seed === "number" ? Math.floor(input.seed) : randomSeed();
  const config = mergeConfig(input.config, seed);
  const players = Array.from(new Set([input.createdBy, input.opponentId].filter((v): v is string => Boolean(v))));
  if (players.length === 0) {
    throw new Error("At least one player is required");
  }
  const match: AsyncSameSeedMatch = {
    id: `m_${idCounter++}`,
    createdBy: input.createdBy,
    players,
    seed,
    config,
    initialGrid: createInitialGrid(config),
    status: "open",
    createdAtISO: new Date().toISOString(),
    submissions: []
  };
  globalStore.__binary2048_async_match_id = idCounter;
  matches.set(match.id, match);
  return match;
}

export function getAsyncMatch(id: string) {
  return matches.get(id) ?? null;
}

export function submitAsyncMatchMoves(input: { matchId: string; playerId: string; moves: unknown[] }) {
  const match = matches.get(input.matchId);
  if (!match) throw new Error("Match not found");
  if (!match.players.includes(input.playerId)) throw new Error("Player is not part of this match");
  if (match.submissions.some((submission) => submission.playerId === input.playerId)) {
    throw new Error("Player has already submitted this match");
  }
  const normalizedMoves = input.moves.map((move) => parseAction(move)).filter(Boolean) as Array<
    "left" | "right" | "up" | "down"
  >;
  if (normalizedMoves.length === 0) throw new Error("moves must include at least one valid action");

  const result = simulateBatch({
    seed: match.seed,
    config: match.config,
    initialGrid: match.initialGrid,
    moves: normalizedMoves
  });

  const submission: AsyncMatchSubmission = {
    playerId: input.playerId,
    moves: normalizedMoves,
    score: result.totalScore,
    maxTile: maxTile(result.final.grid),
    movesApplied: result.movesApplied,
    submittedAtISO: new Date().toISOString()
  };
  match.submissions.push(submission);
  if (match.submissions.length >= match.players.length) match.status = "complete";
  matches.set(match.id, match);
  return { match, submission };
}

export function asyncMatchStandings(match: AsyncSameSeedMatch) {
  const sorted = [...match.submissions].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.maxTile !== b.maxTile) return b.maxTile - a.maxTile;
    if (a.movesApplied !== b.movesApplied) return a.movesApplied - b.movesApplied;
    return a.submittedAtISO.localeCompare(b.submittedAtISO);
  });
  return sorted.map((submission, index) => ({
    rank: index + 1,
    playerId: submission.playerId,
    score: submission.score,
    maxTile: submission.maxTile,
    movesApplied: submission.movesApplied
  }));
}

export function resetAsyncMatches() {
  matches.clear();
  idCounter = 1;
  globalStore.__binary2048_async_match_id = idCounter;
}
