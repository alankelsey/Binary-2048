import { NextResponse } from "next/server";
import { getUndoMeta, importSession } from "@/lib/binary2048/sessions";
import type { GameExport } from "@/lib/binary2048/types";

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as GameExport;
    const session = importSession(payload);
    return NextResponse.json({
      id: session.current.id,
      current: session.current,
      steps: session.steps,
      undo: getUndoMeta(session)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import game" },
      { status: 400 }
    );
  }
}
