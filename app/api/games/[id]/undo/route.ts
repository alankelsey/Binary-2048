import { NextResponse } from "next/server";
import { undoSession } from "@/lib/binary2048/sessions";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = undoSession(id);
  if (!session) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  return NextResponse.json({
    id,
    current: session.current,
    stepCount: session.steps.length
  });
}
