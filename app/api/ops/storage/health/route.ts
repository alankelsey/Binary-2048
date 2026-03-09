import { NextResponse } from "next/server";
import { buildCanonicalRunRecord } from "@/lib/binary2048/run-record";
import { getRunStore } from "@/lib/binary2048/run-store";
import { createSession, exportSession, moveSession } from "@/lib/binary2048/sessions";
import type { Cell } from "@/lib/binary2048/types";

function isAdmin(req: Request) {
  const expected = process.env.BINARY2048_ADMIN_TOKEN ?? "";
  if (!expected) return false;
  const provided = req.headers.get("x-admin-token") ?? "";
  return provided === expected;
}

export async function GET(req: Request) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Admin token required" }, { status: 401 });
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

    return NextResponse.json(
      {
        ok: true,
        runId,
        env: {
          runStore: process.env.BINARY2048_RUN_STORE ?? "memory",
          sessionStore: process.env.BINARY2048_SESSION_STORE ?? process.env.BINARY2048_RUN_STORE ?? "memory",
          replayArtifactStore: process.env.BINARY2048_REPLAY_ARTIFACT_STORE ?? "inline",
          mongoUriPresent: Boolean(process.env.BINARY2048_MONGO_URI),
          s3BucketPresent: Boolean(process.env.BINARY2048_REPLAY_S3_BUCKET)
        },
        persisted: {
          replayStorage: stored?.replayRef ? "s3" : "inline",
          hasReplayPayload: Boolean(replay?.moves?.length),
          rulesetId: stored?.rulesetId ?? null
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

