import { NextResponse } from "next/server";
import { listLeaderboardEntries } from "@/lib/binary2048/leaderboard";

function parseLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(100, Math.floor(parsed));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  return NextResponse.json({
    limit,
    entries: listLeaderboardEntries(limit)
  });
}
