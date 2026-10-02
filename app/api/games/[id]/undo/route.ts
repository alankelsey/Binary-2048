import { SessionConflictError } from "@/lib/binary2048/session-store";
import { NextResponse } from "next/server";
import { exportRecoverySnapshot, getUndoMeta, resolveSessionWithRecovery, undoSession } from "@/lib/binary2048/sessions";
import type { GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { recoverySnapshot?: GameExport | SessionRecoverySnapshot };
  let activeId = id;
  let activeSession;
  try {
    activeSession = (await resolveSessionWithRecovery(activeId, body.recoverySnapshot));
    if (activeSession) activeId = activeSession.current.id;
  } catch {
    return NextResponse.json({ error: "Invalid recovery snapshot" }, { status: 400 });
  }
  let result;
  try { result = await undoSession(activeId, activeSession ?? undefined); }
  catch (error) { return NextResponse.json({ error: error instanceof SessionConflictError ? error.message : "Session storage unavailable" }, { status: error instanceof SessionConflictError ? 409 : 503 }); }
  if (!result.session) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (result.error === "LIMIT_REACHED") {
    return NextResponse.json(
      {
        error: "Undo limit reached",
        id: activeId,
        current: result.session.current,
        recoverySnapshot: (await exportRecoverySnapshot(activeId, result.session)),
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
    recoverySnapshot: (await exportRecoverySnapshot(activeId, result.session)),
    stepCount: session.steps.length,
    undo: getUndoMeta(session),
    integrity: session.integrity
  });
}
