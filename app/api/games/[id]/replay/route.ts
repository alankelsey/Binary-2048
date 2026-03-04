import { NextResponse } from "next/server";
import { exportSession } from "@/lib/binary2048/sessions";
import { exportToCompactReplay } from "@/lib/binary2048/replay-format";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const exported = exportSession(id);
  if (!exported) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const replay = exportToCompactReplay(exported);
  return NextResponse.json({
    header: replay.header,
    moves: replay.moves
  });
}
