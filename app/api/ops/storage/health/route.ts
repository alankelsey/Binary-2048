import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
import { buildCanonicalRunRecord } from "@/lib/binary2048/run-record";
import { getRunStore } from "@/lib/binary2048/run-store";
import {
  listLeaderboardEntriesByPlayer,
  removeLeaderboardEntriesByPlayer,
  submitLeaderboardEntry
} from "@/lib/binary2048/leaderboard";
import { createSession, exportSession, moveSession } from "@/lib/binary2048/sessions";
import type { Cell } from "@/lib/binary2048/types";

export async function GET(req: Request) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Admin authorization required" }, { status: 401 });
  }

  try {
    const initialGrid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const session = createSession(
      {
        seed: Date.now(),
        spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
      },
      initialGrid,
      { sessionClass: "ranked" }
    );
    moveSession(session.current.id, "left");
    const exported = exportSession(session.current.id);
    if (!exported) {
      throw new Error("Failed to export smoke session");
    }

    const runId = `smoke_storage_${Date.now()}`;
    const runRecord = buildCanonicalRunRecord({
      id: runId,
      playerId: "ops-smoke",
      userTier: "authed",
      gameId: session.current.id,
      exported,
      integrity: session.integrity
    });
    runRecord.contestId = "ops-storage-smoke";

    const store = getRunStore();
    await store.upsertRun(runRecord);
    const stored = await store.getRun(runId);
    const replay = await store.getRunReplay(runId);
    const leaderboardPlayerId = `ops-smoke-${Date.now()}`;
    let leaderboardRoundTrip = false;
    let leaderboardRemoved = 0;
    try {
      const submitted = await submitLeaderboardEntry({
        playerId: leaderboardPlayerId,
        userTier: "authed",
        gameId: session.current.id,
        session
      });
      const entries = await listLeaderboardEntriesByPlayer(leaderboardPlayerId, 10);
      leaderboardRoundTrip = entries.some((entry) => entry.id === submitted.entry.id);
    } finally {
      leaderboardRemoved = await removeLeaderboardEntriesByPlayer(leaderboardPlayerId);
    }

    return NextResponse.json(
      {
        ok: true,
        runId,
        env: {
          runStore: process.env.BINARY2048_RUN_STORE ?? "memory",
          sessionStore: process.env.BINARY2048_SESSION_STORE ?? process.env.BINARY2048_RUN_STORE ?? "memory",
          leaderboardStore: process.env.BINARY2048_LEADERBOARD_STORE ?? "memory",
          replayArtifactStore: process.env.BINARY2048_REPLAY_ARTIFACT_STORE ?? "inline",
          mongoUriPresent: Boolean(process.env.BINARY2048_MONGO_URI),
          s3BucketPresent: Boolean(process.env.BINARY2048_REPLAY_S3_BUCKET)
        },
        persisted: {
          replayStorage: stored?.replayRef ? "s3" : "inline",
          hasReplayPayload: Boolean(replay?.moves?.length),
          rulesetId: stored?.rulesetId ?? null,
          leaderboardRoundTrip,
          leaderboardRemoved
        }
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Storage health failed"
      },
      { status: 500 }
    );
  }
}
