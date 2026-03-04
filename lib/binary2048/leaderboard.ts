import { stateHash } from "@/lib/binary2048/ai";
import type { GameSession } from "@/lib/binary2048/types";

export type LeaderboardEntry = {
  id: string;
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  score: number;
  moves: number;
  maxTile: number;
  stateHash: string;
  rulesetId: string;
  submittedAtISO: string;
};

type SubmitLeaderboardParams = {
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  session: GameSession;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_leaderboard?: Map<string, LeaderboardEntry>;
};

const leaderboardStore = globalStore.__binary2048_leaderboard ?? new Map<string, LeaderboardEntry>();
globalStore.__binary2048_leaderboard = leaderboardStore;

function getMaxTile(session: GameSession): number {
  let max = 0;
  for (const row of session.current.grid) {
    for (const cell of row) {
      if (cell?.t !== "n") continue;
      max = Math.max(max, cell.v);
    }
  }
  return max;
}

function getMovedStepCount(session: GameSession): number {
  let moved = 0;
  for (const step of session.steps) {
    if (step.moved) moved += 1;
  }
  return moved;
}

function entrySort(a: LeaderboardEntry, b: LeaderboardEntry) {
  if (a.score !== b.score) return b.score - a.score;
  if (a.maxTile !== b.maxTile) return b.maxTile - a.maxTile;
  if (a.moves !== b.moves) return a.moves - b.moves;
  return a.submittedAtISO.localeCompare(b.submittedAtISO);
}

export function submitLeaderboardEntry(params: SubmitLeaderboardParams) {
  const { session, playerId, userTier, gameId } = params;
  const entry: LeaderboardEntry = {
    id: `lb_${gameId}`,
    playerId,
    userTier,
    gameId,
    score: session.current.score,
    moves: getMovedStepCount(session),
    maxTile: getMaxTile(session),
    stateHash: stateHash(session.current),
    rulesetId: "binary2048-v1",
    submittedAtISO: new Date().toISOString()
  };
  leaderboardStore.set(entry.id, entry);
  const entries = listLeaderboardEntries();
  const rank = entries.findIndex((item) => item.id === entry.id) + 1;
  return {
    entry,
    rank: rank <= 0 ? entries.length : rank,
    total: entries.length
  };
}

export function listLeaderboardEntries(limit = 20) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  return Array.from(leaderboardStore.values()).sort(entrySort).slice(0, safeLimit);
}

export function resetLeaderboard() {
  leaderboardStore.clear();
}
