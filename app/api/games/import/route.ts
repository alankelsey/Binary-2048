import { NextResponse } from "next/server";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { exportRecoverySnapshot, getUndoMeta, importRecoveryPayload } from "@/lib/binary2048/sessions";
import type { GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as GameExport | SessionRecoverySnapshot;
    const session = importRecoveryPayload(payload);
    return NextResponse.json({
      id: session.current.id,
      current: session.current,
      recoverySnapshot: exportRecoverySnapshot(session.current.id),
      steps: session.steps,
      undo: getUndoMeta(session),
      integrity: session.integrity,
      economy: {
        canContinueAfterWin: canContinueAfterWin(session.integrity.sessionClass)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import game" },
      { status: 400 }
    );
  }
}
