import { NextResponse } from "next/server";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { parseJsonWithLimit, RequestBodyTooLargeError } from "@/lib/binary2048/request-body-limit";
import { exportRecoverySnapshot, getUndoMeta, importRecoveryPayload } from "@/lib/binary2048/sessions";
import type { GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";

const MAX_GAME_IMPORT_BODY_BYTES = 256 * 1024;

export async function POST(req: Request) {
  try {
    const payload = await parseJsonWithLimit<GameExport | SessionRecoverySnapshot>(
      req,
      MAX_GAME_IMPORT_BODY_BYTES
    );
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
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import game" },
      { status: 400 }
    );
  }
}
