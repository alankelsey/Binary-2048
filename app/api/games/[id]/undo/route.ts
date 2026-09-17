import { NextResponse } from "next/server";
import { exportRecoverySnapshot, getUndoMeta, resolveSessionWithRecovery, undoSession } from "@/lib/binary2048/sessions";
import type { GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { recoverySnapshot?: GameExport | SessionRecoverySnapshot };
  let activeId = id;
  try {
    const activeSession = resolveSessionWithRecovery(activeId, body.recoverySnapshot);
    if (activeSession) activeId = activeSession.current.id;
  } catch {
    return NextResponse.json({ error: "Invalid recovery snapshot" }, { status: 400 });
  }
  const result = undoSession(activeId);
  if (!result.session) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (result.error === "LIMIT_REACHED") {
    return NextResponse.json(
      {
        error: "Undo limit reached",
        id: activeId,
        current: result.session.current,
        recoverySnapshot: exportRecoverySnapshot(activeId),
        stepCount: result.session.steps.length,
        undo: getUndoMeta(result.session),
        integrity: result.session.integrity
      },
      { status: 409 }
    );
  }
  const session = result.session;

  return NextResponse.json({
    id: activeId,
    current: session.current,
    recoverySnapshot: exportRecoverySnapshot(activeId),
    stepCount: session.steps.length,
    undo: getUndoMeta(session),
    integrity: session.integrity
  });
}
