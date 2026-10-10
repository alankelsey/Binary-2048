import { SessionConflictError } from "@/lib/binary2048/session-store";
import { NextResponse } from "next/server";
import { parseAction, toActionCode } from "@/lib/binary2048/action";
import { stateHash } from "@/lib/binary2048/ai";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { checkMoveRateLimit, rateLimitHeaders } from "@/lib/binary2048/rate-limit";
import { recordMoveRouteTelemetry, recordRouteTelemetry } from "@/lib/binary2048/ops-telemetry";
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
      recordRouteTelemetry({ route: "/api/games/:id/move", status, durationMs });
      recordMoveRouteTelemetry({
        status,
        sessionPath,
        rateLimitBackend: quota.backend,
        timingsMs: Object.fromEntries(timings)
      });
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
  const body = (await req.json().catch(() => ({}))) as { dir?: unknown; action?: unknown; expectStateHash?: unknown; recoverySnapshot?: GameExport | SessionRecoverySnapshot };
  const dir = parseAction(body.dir ?? body.action);
  timings.set("request_parse", Math.max(0, performance.now() - parseStartedAt));
  if (!dir) return respond({ error: "dir or action is required" }, 400);
  let activeId = id;
  let activeSession;
  try {
    const resolution = await resolveSessionWithRecoveryDetails(activeId, body.recoverySnapshot, recordTiming);
    activeSession = resolution.session;
    sessionPath = resolution.path;
    if (activeSession) activeId = activeSession.current.id;
  } catch {
    return respond({ error: "Invalid recovery snapshot" }, 400);
  }
  if (typeof body.expectStateHash === "string") {
    if (!activeSession) return respond({ error: "Game not found" }, 404);
    const actualHash = stateHash(activeSession.current);
    if (actualHash !== body.expectStateHash) {
      return respond(
        {
          error: "State hash mismatch",
          expected: body.expectStateHash,
          actual: actualHash
        },
        409
      );
    }
  }
  let session;
  try { session = await moveSession(activeId, dir, activeSession ?? undefined, recordTiming); }
  catch (error) { return respond({ error: error instanceof SessionConflictError ? error.message : "Session storage unavailable" }, error instanceof SessionConflictError ? 409 : 503); }
  if (!session) return respond({ error: "Game not found" }, 404);
  const lastStep = session.steps[session.steps.length - 1];
  const changed = lastStep?.moved ?? false;
  const reward = (lastStep?.after?.score ?? session.current.score) - (lastStep?.before?.score ?? session.current.score);
  const spawned = firstSpawn(lastStep?.events ?? []);
  const recoverySnapshot = (await exportRecoverySnapshot(activeId, session, recordTiming));
  return respond({
    id: activeId,
    current: session.current,
    recoverySnapshot,
    stepCount: session.steps.length,
    lastStep,
    action: toActionCode(dir),
    dir,
    stateHash: stateHash(session.current),
    changed,
    reward,
    done: Boolean(session.current.over || session.current.won),
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
    }
  });
}
