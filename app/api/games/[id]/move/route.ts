import { NextResponse } from "next/server";
import { moveSession } from "@/lib/binary2048/sessions";
import type { Dir } from "@/lib/binary2048/types";

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
    lastStep: session.steps[session.steps.length - 1]
  });
}
