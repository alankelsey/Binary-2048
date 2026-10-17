import { SessionConflictError, SessionStorageUnavailableError } from "@/lib/binary2048/session-store";
import { NextResponse } from "next/server";
import { parseAction, toActionCode } from "@/lib/binary2048/action";
import { stateHash } from "@/lib/binary2048/ai";
import { legacyGameStateHashV1, STATE_HASH_VERSION } from "@/lib/binary2048/state-identity";
import {
  COMPACT_CHECKPOINT_INTERVAL,
  COMPACT_SYNC_VERSION,
  isCompactSyncVersion,
  shouldIssueCompactCheckpoint
} from "@/lib/binary2048/compact-sync";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { checkMoveRateLimit, rateLimitHeaders } from "@/lib/binary2048/rate-limit";
import { recordMoveRouteTelemetry, recordRouteTelemetry } from "@/lib/binary2048/ops-telemetry";
import { beginMoveRuntimeObservation, shouldSampleMoveRuntime } from "@/lib/binary2048/move-runtime-telemetry";
import {
  exportRecoverySnapshot,
  getUndoMeta,
  moveSession,
  resolveSessionWithRecoveryDetails,
  type SessionPath,
  type SessionTimingName
} from "@/lib/binary2048/sessions";
import type { GameEvent, GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";

type RouteTimingName = SessionTimingName | "rate_limit_identity" | "rate_limit_counter" | "request_parse" | "response_encode" | "total";

const SERVER_TIMING_ORDER: RouteTimingName[] = [
  "rate_limit_identity",
  "rate_limit_counter",
  "request_parse",
  "session_lookup",
  "recovery_verify",
  "recovery_replay",
  "recovery_import",
  "engine_move",
  "session_persist",
  "snapshot_build",
  "snapshot_sign",
  "response_encode",
  "total"
];

function formatDuration(durationMs: number) {
  return Math.max(0, durationMs).toFixed(2);
}

function firstSpawn(events: GameEvent[]) {
  const found = events.find((event) => event.type === "spawn");
  if (!found || found.type !== "spawn") return null;
  return {
    r: found.at[0],
    c: found.at[1],
    tile: found.tile
  };
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const routeStartedAt = performance.now();
  const runtimeObservation = beginMoveRuntimeObservation();
  const timings = new Map<string, number>();
  const recordTiming = (name: Exclude<RouteTimingName, "request_parse" | "response_encode" | "total">, durationMs: number) => {
    timings.set(name, (timings.get(name) ?? 0) + Math.max(0, durationMs));
  };
  let sessionPath: SessionPath | "not_checked" = "not_checked";
  const serverTimingHeader = () => {
    timings.set("total", Math.max(0, performance.now() - routeStartedAt));
    const metrics = SERVER_TIMING_ORDER.flatMap((name) => {
      const durationMs = timings.get(name);
      return durationMs === undefined ? [] : [`${name};dur=${formatDuration(durationMs)}`];
    });
    return metrics.join(", ");
  };
  const { id } = await context.params;
  const quota = await checkMoveRateLimit(req, recordTiming);
  let telemetryRecorded = false;
  const respond = (body: unknown, status = 200) => {
    const encodeStartedAt = performance.now();
    const response = NextResponse.json(body, { status, headers: rateLimitHeaders(quota) });
    timings.set("response_encode", Math.max(0, performance.now() - encodeStartedAt));
    const header = serverTimingHeader();
    response.headers.set("Server-Timing", header);
    response.headers.set("Cache-Control", "no-store");
    if (!telemetryRecorded) {
      telemetryRecorded = true;
      const durationMs = timings.get("total") ?? 0;
      const runtime = runtimeObservation.finish();
      try {
        recordRouteTelemetry({ route: "/api/games/:id/move", status, durationMs });
        recordMoveRouteTelemetry({
          status,
          sessionPath,
          rateLimitBackend: quota.backend,
          timingsMs: Object.fromEntries(timings),
          ...(shouldSampleMoveRuntime(runtime, status, sessionPath) ? { runtime } : {})
        });
      } catch {
        // Observability must never change gameplay behavior.
      }
    }
    return response;
  };
  if (!quota.allowed) {
    return respond({
      error: "Rate limit exceeded",
      route: "game_move",
      limit: quota.limit,
      remaining: quota.remaining,
      retryAfterSeconds: quota.retryAfterSeconds
    }, 429);
  }
  const parseStartedAt = performance.now();
  const body = (await req.json().catch(() => ({}))) as {
    dir?: unknown;
    action?: unknown;
    expectTurn?: unknown;
    expectStateHash?: unknown;
    expectStateHashVersion?: unknown;
    recoverySnapshot?: GameExport | SessionRecoverySnapshot;
    syncVersion?: unknown;
  };
  const dir = parseAction(body.dir ?? body.action);
  timings.set("request_parse", Math.max(0, performance.now() - parseStartedAt));
  if (!dir) return respond({ error: "dir or action is required" }, 400);
  if (body.syncVersion !== undefined && !isCompactSyncVersion(body.syncVersion)) {
    return respond(
      { error: "Unsupported compact sync version", supportedSyncVersion: COMPACT_SYNC_VERSION },
      400
    );
  }
  if (
    isCompactSyncVersion(body.syncVersion) &&
    (typeof body.expectStateHash !== "string" || body.expectStateHashVersion !== STATE_HASH_VERSION || !Number.isInteger(body.expectTurn))
  ) {
    return respond(
      {
        error: "Compact synchronization requires expectTurn and the current versioned state hash",
        supportedStateHashVersion: STATE_HASH_VERSION
      },
      400
    );
  }
  if (
    body.expectStateHashVersion !== undefined &&
    body.expectStateHashVersion !== STATE_HASH_VERSION
  ) {
    return respond(
      {
        error: "Unsupported state hash version",
        supportedStateHashVersion: STATE_HASH_VERSION
      },
      400
    );
  }
  let activeId = id;
  let activeSession;
  try {
    const resolution = await resolveSessionWithRecoveryDetails(activeId, body.recoverySnapshot, recordTiming);
    activeSession = resolution.session;
    sessionPath = resolution.path;
    if (activeSession) activeId = activeSession.current.id;
  } catch (error) {
    if (error instanceof SessionConflictError) return respond({ error: error.message }, 409);
    if (error instanceof SessionStorageUnavailableError) return respond({ error: error.message }, 503);
    return respond({ error: "Invalid recovery snapshot" }, 400);
  }
  if (typeof body.expectStateHash === "string") {
    if (!activeSession) return respond({ error: "Game not found" }, 404);
    const actualHash = stateHash(activeSession.current);
    const compatibleHashes = body.expectStateHashVersion === STATE_HASH_VERSION
      ? [actualHash]
      : [actualHash, legacyGameStateHashV1(activeSession.current)];
    if (!compatibleHashes.includes(body.expectStateHash)) {
      return respond(
        {
          error: "State hash mismatch",
          expected: body.expectStateHash,
          actual: actualHash,
          actualStateHashVersion: STATE_HASH_VERSION
        },
        409
      );
    }
  }
  if (
    isCompactSyncVersion(body.syncVersion) &&
    activeSession &&
    (!Number.isInteger(body.expectTurn) || body.expectTurn !== activeSession?.current.turn)
  ) {
    return respond(
      {
        error: "Turn mismatch",
        expectedTurn: body.expectTurn,
        actualTurn: activeSession?.current.turn ?? null
      },
      409
    );
  }
  let session;
  try { session = await moveSession(activeId, dir, activeSession, recordTiming); }
  catch (error) { return respond({ error: error instanceof SessionConflictError ? error.message : "Session storage is temporarily unavailable" }, error instanceof SessionConflictError ? 409 : 503); }
  if (!session) return respond({ error: "Game not found" }, 404);
  const lastStep = session.steps[session.steps.length - 1];
  const changed = lastStep?.moved ?? false;
  const reward = (lastStep?.after?.score ?? session.current.score) - (lastStep?.before?.score ?? session.current.score);
  const spawned = firstSpawn(lastStep?.events ?? []);
  const compact = isCompactSyncVersion(body.syncVersion);
  const terminal = Boolean(session.current.over || session.current.won);
  const checkpoint = !compact || shouldIssueCompactCheckpoint({
    turn: session.steps.length,
    terminal,
    recovered: Boolean(body.recoverySnapshot)
  });
  const recoverySnapshot = checkpoint
    ? (await exportRecoverySnapshot(activeId, session, recordTiming))
    : undefined;
  return respond({
    id: activeId,
    current: session.current,
    ...(recoverySnapshot ? { recoverySnapshot } : {}),
    stepCount: session.steps.length,
    lastStep,
    action: toActionCode(dir),
    dir,
    stateHash: stateHash(session.current),
    stateHashVersion: STATE_HASH_VERSION,
    changed,
    reward,
    done: terminal,
    spawned,
    undo: getUndoMeta(session),
    integrity: session.integrity,
    economy: {
      canContinueAfterWin: canContinueAfterWin(session.integrity.sessionClass)
    },
    info: {
      changed,
      spawned,
      events: lastStep?.events ?? [],
      illegalMove: !changed
    },
    ...(compact
      ? {
          sync: {
            version: COMPACT_SYNC_VERSION,
            checkpoint,
            checkpointStep: checkpoint ? session.steps.length : null,
            checkpointInterval: COMPACT_CHECKPOINT_INTERVAL
          }
        }
      : {})
  });
}
