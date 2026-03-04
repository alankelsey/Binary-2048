import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { asyncMatchStandings, submitAsyncMatchMoves } from "@/lib/binary2048/async-pvp";

type SubmitBody = {
  playerId?: string;
  moves?: unknown[];
};

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = ((await req.json().catch(() => ({}))) as SubmitBody);
    const claims = getVerifiedAuthClaims(req);
    const playerId =
      (typeof body.playerId === "string" && body.playerId.trim()) ||
      claims?.sub ||
      "guest_local";

    const { match, submission } = submitAsyncMatchMoves({
      matchId: id,
      playerId,
      moves: Array.isArray(body.moves) ? body.moves : []
    });

    return NextResponse.json(
      {
        submission,
        match,
        standings: asyncMatchStandings(match)
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid async submission";
    const status = message === "Match not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
