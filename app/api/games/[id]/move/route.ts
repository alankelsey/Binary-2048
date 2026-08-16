import { NextResponse } from "next/server";
import { parseAction, toActionCode } from "@/lib/binary2048/action";
import { stateHash } from "@/lib/binary2048/ai";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { checkMoveRateLimit, rateLimitHeaders } from "@/lib/binary2048/rate-limit";
import { getSession, getUndoMeta, moveSession } from "@/lib/binary2048/sessions";
import type { GameEvent } from "@/lib/binary2048/types";

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
  const { id } = await context.params;
  const quota = await checkMoveRateLimit(req);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        route: "game_move",
        limit: quota.limit,
        remaining: quota.remaining,
        retryAfterSeconds: quota.retryAfterSeconds
      },
      { status: 429, headers: rateLimitHeaders(quota) }
    );
  }
  const respond = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: rateLimitHeaders(quota) });
  const body = (await req.json().catch(() => ({}))) as { dir?: unknown; action?: unknown; expectStateHash?: unknown };
  const dir = parseAction(body.dir ?? body.action);
  if (!dir) return respond({ error: "dir or action is required" }, 400);
  if (typeof body.expectStateHash === "string") {
    const current = getSession(id);
    if (!current) return respond({ error: "Game not found" }, 404);
    const actualHash = stateHash(current.current);
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
  const session = moveSession(id, dir);
  if (!session) return respond({ error: "Game not found" }, 404);
  const lastStep = session.steps[session.steps.length - 1];
  const changed = lastStep?.moved ?? false;
  const reward = (lastStep?.after?.score ?? session.current.score) - (lastStep?.before?.score ?? session.current.score);
  const spawned = firstSpawn(lastStep?.events ?? []);
  return respond({
    id,
    current: session.current,
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
