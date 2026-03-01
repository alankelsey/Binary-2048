import { NextResponse } from "next/server";
import { moveSession } from "@/lib/binary2048/sessions";
import type { Dir, GameEvent } from "@/lib/binary2048/types";

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
  const body = (await req.json().catch(() => ({}))) as { dir?: Dir };
  if (!body.dir) return NextResponse.json({ error: "dir is required" }, { status: 400 });
  const session = moveSession(id, body.dir);
  if (!session) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  return NextResponse.json({
    id,
    current: session.current,
    stepCount: session.steps.length,
    lastStep: session.steps[session.steps.length - 1],
    changed: session.steps[session.steps.length - 1]?.moved ?? false,
    reward:
      (session.steps[session.steps.length - 1]?.after?.score ?? session.current.score) -
      (session.steps[session.steps.length - 1]?.before?.score ?? session.current.score),
    done: Boolean(session.current.over || session.current.won),
    spawned: firstSpawn(session.steps[session.steps.length - 1]?.events ?? []),
    info: {
      changed: session.steps[session.steps.length - 1]?.moved ?? false,
      spawned: firstSpawn(session.steps[session.steps.length - 1]?.events ?? []),
      events: session.steps[session.steps.length - 1]?.events ?? [],
      illegalMove: !(session.steps[session.steps.length - 1]?.moved ?? false)
    }
  });
}
