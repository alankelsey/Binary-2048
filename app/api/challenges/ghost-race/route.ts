import { NextResponse } from "next/server";
import { buildGhostRaceChallenge, listGhostRaceSubmissions } from "@/lib/binary2048/ghost-race";

function parseSeed(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 2048;
  return Math.max(1, Math.floor(parsed));
}

function parseMoves(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 250;
  return Math.max(10, Math.min(1000, Math.floor(parsed)));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const seed = parseSeed(url.searchParams.get("seed"));
  const maxMoves = parseMoves(url.searchParams.get("maxMoves"));
  const challenge = buildGhostRaceChallenge(seed, maxMoves);
  return NextResponse.json({
    challenge,
    submissions: listGhostRaceSubmissions(20)
  });
}
