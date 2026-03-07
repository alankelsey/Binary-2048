import { parseAction } from "@/lib/binary2048/action";
import { DEFAULT_CONFIG, generateBitstormInitialGrid, runScenario } from "@/lib/binary2048/engine";
import { toCompactReplayPayload } from "@/lib/binary2048/replay-format";
import type { Cell, Dir, GameConfig } from "@/lib/binary2048/types";

export type DailyChallenge = {
  challengeId: string;
  dateISO: string;
  windowStartISO: string;
  windowEndISO: string;
  seed: number;
  mode: "bitstorm_daily";
  config: GameConfig;
  initialGrid: ReturnType<typeof generateBitstormInitialGrid>;
};

export type DailyChallengeEntry = {
  id: string;
  challengeId: string;
  playerId: string;
  score: number;
  moves: number;
  maxTile: number;
  submittedAtISO: string;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_daily_challenge_board?: Map<string, DailyChallengeEntry[]>;
};

const boardStore = globalStore.__binary2048_daily_challenge_board ?? new Map<string, DailyChallengeEntry[]>();
globalStore.__binary2048_daily_challenge_board = boardStore;

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function seedFromDate(dateKey: string) {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 2147483647 || 1;
}

function sortEntries(a: DailyChallengeEntry, b: DailyChallengeEntry) {
  if (a.score !== b.score) return b.score - a.score;
  if (a.maxTile !== b.maxTile) return b.maxTile - a.maxTile;
  if (a.moves !== b.moves) return a.moves - b.moves;
  return a.submittedAtISO.localeCompare(b.submittedAtISO);
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

export function getDailyChallenge(date = new Date()): DailyChallenge {
  const dateISO = utcDateKey(date);
  const seed = seedFromDate(dateISO);
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    seed,
    spawn: {
      ...DEFAULT_CONFIG.spawn
    }
  };
  const initialGrid = generateBitstormInitialGrid(config);
  return {
    challengeId: `daily_${dateISO}`,
    dateISO,
    windowStartISO: `${dateISO}T00:00:00.000Z`,
    windowEndISO: `${dateISO}T23:59:59.999Z`,
    seed,
    mode: "bitstorm_daily",
    config,
    initialGrid
  };
}

export function listDailyChallengeEntries(challengeId: string, limit = 20) {
  const entries = boardStore.get(challengeId) ?? [];
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  return [...entries].sort(sortEntries).slice(0, safeLimit);
}

export function submitDailyChallengeReplay(playerId: string, payload: unknown, now = new Date()) {
  const challenge = getDailyChallenge(now);
  const compact = toCompactReplayPayload(payload);
  if (compact.header.seed !== challenge.seed || compact.config.seed !== challenge.seed) {
    throw new Error("Replay seed does not match today's Bitstorm Daily seed");
  }
  const moves = compact.moves.map((move) => parseAction(move)).filter((dir): dir is Dir => dir !== null);
  const exported = runScenario(challenge.config, challenge.initialGrid, moves);
  const existing = boardStore.get(challenge.challengeId) ?? [];
  const next: DailyChallengeEntry = {
    id: `dly_${challenge.challengeId}_${playerId}`,
    challengeId: challenge.challengeId,
    playerId,
    score: exported.final.score,
    moves: exported.final.turn,
    maxTile: getMaxTile(exported.final.grid),
    submittedAtISO: now.toISOString()
  };
  const filtered = existing.filter((entry) => entry.playerId !== playerId);
  filtered.push(next);
  boardStore.set(challenge.challengeId, filtered.sort(sortEntries));
  const rank = (boardStore.get(challenge.challengeId) ?? []).findIndex((entry) => entry.playerId === playerId) + 1;
  return {
    challenge,
    entry: next,
    rank: rank <= 0 ? filtered.length : rank,
    total: filtered.length
  };
}

export function resetDailyChallengeStore() {
  boardStore.clear();
}
