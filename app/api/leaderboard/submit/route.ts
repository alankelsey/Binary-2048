import { NextResponse } from "next/server";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { resolveSandboxSubmissionMode, verifySandboxSubmissionAccess } from "@/lib/binary2048/league-sandbox";
import { exportToCompactReplay } from "@/lib/binary2048/replay-format";
import { createReplaySignature } from "@/lib/binary2048/replay-signature";
import { buildCanonicalRunRecord } from "@/lib/binary2048/run-record";
import { getRunStore } from "@/lib/binary2048/run-store";
import { getLeaderboardEligibility, submitLeaderboardEntry } from "@/lib/binary2048/leaderboard";
import { exportSession, getSession } from "@/lib/binary2048/sessions";

type SubmitBody = {
  gameId?: string;
  namespace?: "production" | "sandbox";
  isSandbox?: boolean;
  isPractice?: boolean;
  seasonMode?: "live" | "preview";
  shadowWrite?: boolean;
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
  const sandboxAccess = verifySandboxSubmissionAccess(req, body);
  if (!sandboxAccess.ok) {
    return NextResponse.json({ error: sandboxAccess.error }, { status: sandboxAccess.status ?? 400 });
  }
  const submitMode = resolveSandboxSubmissionMode(body);

  const session = getSession(body.gameId);
  if (!session) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (!session.current.over && !session.current.won) {
    return NextResponse.json({ error: "Game must be finished before submission" }, { status: 409 });
  }
  const eligibility = getLeaderboardEligibility(session);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason, bracket: eligibility.bracket }, { status: 403 });
  }

  const exported = exportSession(body.gameId);
  const replaySignature = (() => {
    const signingSecret = process.env.BINARY2048_REPLAY_CODE_SECRET ?? "";
    if (!signingSecret || !exported) return undefined;
    return createReplaySignature(exportToCompactReplay(exported), signingSecret);
  })();

  const submitted = submitLeaderboardEntry({
    namespace: submitMode.namespace,
    isSandbox: submitMode.isSandbox,
    isPractice: submitMode.isPractice,
    seasonMode: submitMode.seasonMode,
    replaySignature,
    playerId: claims.sub,
    userTier: claims.tier,
    gameId: body.gameId,
    session
  });

  if (exported) {
    const runRecord = buildCanonicalRunRecord({
      id: `run_${body.gameId}`,
      playerId: claims.sub,
      userTier: claims.tier,
      gameId: body.gameId,
      exported,
      integrity: session.integrity,
      replaySignature
    });
    await getRunStore().upsertRun(runRecord);
  }

  return NextResponse.json(
    {
      submitted: true,
      rank: submitted.rank,
      total: submitted.total,
      storedNamespace: submitMode.namespace,
      shadowWrite: submitMode.shadowWrite,
      entry: submitted.entry
    },
    { status: 200 }
  );
}
