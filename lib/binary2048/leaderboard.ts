import { stateHash } from "@/lib/binary2048/ai";
import type { GameSession } from "@/lib/binary2048/types";

export type LeaderboardEntry = {
  id: string;
  namespace: "production" | "sandbox";
  isSandbox: boolean;
  isPractice: boolean;
  seasonMode: "live" | "preview";
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  score: number;
  moves: number;
  maxTile: number;
  stateHash: string;
  rulesetId: string;
  replaySignature?: string;
  submittedAtISO: string;
};

type SubmitLeaderboardParams = {
  namespace?: "production" | "sandbox";
  isSandbox?: boolean;
  isPractice?: boolean;
  seasonMode?: "live" | "preview";
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  session: GameSession;
  replaySignature?: string;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_leaderboard?: Map<string, LeaderboardEntry>;
};

const leaderboardStore = globalStore.__binary2048_leaderboard ?? new Map<string, LeaderboardEntry>();
globalStore.__binary2048_leaderboard = leaderboardStore;

type LeaderboardEligibility = {
  eligible: boolean;
  bracket: "ranked_pure" | "ranked_boosted";
  reason?: string;
};

function countNonEmptyCells(session: GameSession): number {
  let count = 0;
  for (const row of session.initialState.grid) {
    for (const cell of row) {
      if (cell) count += 1;
    }
  }
  return count;
}

export function getLeaderboardEligibility(session: GameSession): LeaderboardEligibility {
  if (session.integrity.sessionClass !== "ranked" || session.integrity.source !== "created") {
    return {
      eligible: false,
      bracket: "ranked_boosted",
      reason: "Only ranked created sessions are eligible"
    };
  }
  if (countNonEmptyCells(session) !== 2) {
    return {
      eligible: false,
      bracket: "ranked_boosted",
      reason: "Seeded starts are not eligible for ranked leaderboard"
    };
  }
  if (session.undoUsed > 0) {
    return {
      eligible: false,
      bracket: "ranked_boosted",
      reason: "Undo-assisted runs are not eligible for ranked_pure"
    };
  }
  return { eligible: true, bracket: "ranked_pure" };
}

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

type ListLeaderboardOptions = {
  namespace?: "production" | "sandbox";
  includeSandbox?: boolean;
  includePractice?: boolean;
  seasonMode?: "live" | "preview";
};

export function submitLeaderboardEntry(params: SubmitLeaderboardParams) {
  const { session, playerId, userTier, gameId, replaySignature } = params;
  const namespace = params.namespace ?? (params.isSandbox ? "sandbox" : "production");
  const isSandbox = namespace === "sandbox";
  const isPractice = Boolean(params.isPractice);
  const seasonMode = params.seasonMode ?? (isSandbox ? "preview" : "live");
  const entry: LeaderboardEntry = {
    id: `lb_${namespace}_${gameId}`,
    namespace,
    isSandbox,
    isPractice,
    seasonMode,
    playerId,
    userTier,
    gameId,
    score: session.current.score,
    moves: getMovedStepCount(session),
    maxTile: getMaxTile(session),
    stateHash: stateHash(session.current),
    rulesetId: "binary2048-v1",
    replaySignature,
    submittedAtISO: new Date().toISOString()
  };
  leaderboardStore.set(entry.id, entry);
  const entries = listLeaderboardEntries(20, { namespace, includePractice: true, includeSandbox: isSandbox, seasonMode });
  const rank = entries.findIndex((item) => item.id === entry.id) + 1;
  return {
    entry,
    rank: rank <= 0 ? entries.length : rank,
    total: entries.length
  };
}

export function listLeaderboardEntries(limit = 20, options: ListLeaderboardOptions = {}) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  const namespace = options.namespace;
  const includeSandbox = options.includeSandbox ?? false;
  const includePractice = options.includePractice ?? false;
  const seasonMode = options.seasonMode;
  return Array.from(leaderboardStore.values())
    .filter((entry) => {
      if (namespace && entry.namespace !== namespace) return false;
      if (!namespace) {
        if (!includeSandbox && entry.isSandbox) return false;
        if (includeSandbox && !entry.isSandbox) return false;
      }
      if (!includePractice && entry.isPractice) return false;
      if (seasonMode && entry.seasonMode !== seasonMode) return false;
      return true;
    })
    .sort(entrySort)
    .slice(0, safeLimit);
}

export function listLeaderboardEntriesByPlayer(playerId: string, limit = 100) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 100;
  return Array.from(leaderboardStore.values())
    .filter((entry) => entry.playerId === playerId)
    .sort(entrySort)
    .slice(0, safeLimit);
}

export function removeLeaderboardEntriesByPlayer(playerId: string): number {
  let removed = 0;
  for (const [id, entry] of leaderboardStore.entries()) {
    if (entry.playerId !== playerId) continue;
    leaderboardStore.delete(id);
    removed += 1;
  }
  return removed;
}

export function resetLeaderboard() {
  leaderboardStore.clear();
}
