import { NextResponse } from "next/server";
import { getDailyChallenge, listDailyChallengeEntries } from "@/lib/binary2048/daily-challenge";

function parseLimit(raw: string | null) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 20;
  return Math.min(100, Math.floor(value));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const challenge = getDailyChallenge();
  return NextResponse.json({
    challenge,
    leaderboard: listDailyChallengeEntries(challenge.challengeId, limit),
    limit
  });
}
