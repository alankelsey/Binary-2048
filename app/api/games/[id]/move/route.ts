import { NextResponse } from "next/server";
import { parseAction, toActionCode } from "@/lib/binary2048/action";
import { getUndoMeta, moveSession } from "@/lib/binary2048/sessions";
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
  const body = (await req.json().catch(() => ({}))) as { dir?: unknown; action?: unknown };
  const dir = parseAction(body.dir ?? body.action);
  if (!dir) return NextResponse.json({ error: "dir or action is required" }, { status: 400 });
  const session = moveSession(id, dir);
  if (!session) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  const lastStep = session.steps[session.steps.length - 1];
  const changed = lastStep?.moved ?? false;
  const reward = (lastStep?.after?.score ?? session.current.score) - (lastStep?.before?.score ?? session.current.score);
  const spawned = firstSpawn(lastStep?.events ?? []);
  return NextResponse.json({
    id,
    current: session.current,
    stepCount: session.steps.length,
    lastStep,
    action: toActionCode(dir),
    dir,
    changed,
    reward,
    done: Boolean(session.current.over || session.current.won),
    spawned,
    undo: getUndoMeta(session),
    info: {
      changed,
      spawned,
      events: lastStep?.events ?? [],
      illegalMove: !changed
    }
  });
}
