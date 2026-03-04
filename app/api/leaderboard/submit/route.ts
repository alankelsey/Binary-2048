import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { exportToCompactReplay } from "@/lib/binary2048/replay-format";
import { createReplaySignature } from "@/lib/binary2048/replay-signature";
import { submitLeaderboardEntry } from "@/lib/binary2048/leaderboard";
import { exportSession, getSession } from "@/lib/binary2048/sessions";

type SubmitBody = {
  gameId?: string;
};

export async function POST(req: Request) {
  const claims = getVerifiedAuthClaims(req);
  if (!claims?.sub) {
    return NextResponse.json({ error: "Authenticated user required" }, { status: 401 });
  }

  const body = ((await req.json().catch(() => ({}))) as SubmitBody);
  if (!body.gameId) {
    return NextResponse.json({ error: "gameId is required" }, { status: 400 });
  }

  const session = getSession(body.gameId);
  if (!session) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (session.integrity.sessionClass !== "ranked" || session.integrity.source !== "created") {
    return NextResponse.json({ error: "Only ranked created sessions are eligible" }, { status: 403 });
  }
  if (!session.current.over && !session.current.won) {
    return NextResponse.json({ error: "Game must be finished before submission" }, { status: 409 });
  }

  const submitted = submitLeaderboardEntry({
    replaySignature: (() => {
      const signingSecret = process.env.BINARY2048_REPLAY_CODE_SECRET ?? "";
      if (!signingSecret) return undefined;
      const exported = exportSession(body.gameId);
      if (!exported) return undefined;
      return createReplaySignature(exportToCompactReplay(exported), signingSecret);
    })(),
    playerId: claims.sub,
    userTier: claims.tier,
    gameId: body.gameId,
    session
  });

  return NextResponse.json(
    {
      submitted: true,
      rank: submitted.rank,
      total: submitted.total,
      entry: submitted.entry
    },
    { status: 200 }
  );
}
