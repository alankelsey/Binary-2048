import type { LeaderboardEntry } from "@/lib/binary2048/leaderboard";

// Pure, JSX-free presentation helpers for the leaderboard tables. Split out
// from app/leaderboard-view.tsx (which holds the JSX components) so they can
// be unit-tested directly with the project's existing ts-jest setup — this
// repo's tsconfig uses `jsx: "preserve"` with no JSX transform wired into
// Jest, so any `.tsx` file is unrunnable under `npm run test:unit`; plain
// `.ts` modules like this one are the only testable layer for that runner.

export const TIER_LABEL: Record<LeaderboardEntry["userTier"], string> = {
  guest: "Guest",
  authed: "Player",
  paid: "Pro"
};

export function rankClass(rank: number): string {
  if (rank === 1) return "leaderboard-rank top-1";
  if (rank === 2) return "leaderboard-rank top-2";
  if (rank === 3) return "leaderboard-rank top-3";
  return "leaderboard-rank";
}

export function formatSubmittedAt(iso: string): string {
  if (!iso || iso.length < 16) return "-";
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function shortPlayerId(playerId: string): string {
  if (playerId.length <= 14) return playerId;
  return `${playerId.slice(0, 6)}…${playerId.slice(-4)}`;
}
