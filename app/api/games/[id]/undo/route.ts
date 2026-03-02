import { NextResponse } from "next/server";
import { getUndoMeta, undoSession } from "@/lib/binary2048/sessions";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = undoSession(id);
  if (!result.session) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (result.error === "LIMIT_REACHED") {
    return NextResponse.json(
      {
        error: "Undo limit reached",
        id,
        current: result.session.current,
        stepCount: result.session.steps.length,
        undo: getUndoMeta(result.session)
      },
      { status: 409 }
    );
  }
  const session = result.session;

  return NextResponse.json({
    id,
    current: session.current,
    stepCount: session.steps.length,
    undo: getUndoMeta(session)
  });
}
