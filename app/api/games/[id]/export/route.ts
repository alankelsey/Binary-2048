import { NextResponse } from "next/server";
import { exportToCompactReplay } from "@/lib/binary2048/replay-format";
import { exportSession } from "@/lib/binary2048/sessions";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const exported = exportSession(id);
  if (!exported) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  const url = new URL(req.url);
  const compact = url.searchParams.get("compact");
  const wantsCompact = compact === "1" || compact === "true";

  if (wantsCompact) {
    const replay = exportToCompactReplay(exported);
    return NextResponse.json({
      header: replay.header,
      moves: replay.moves
    });
  }

  return new NextResponse(JSON.stringify(exported, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${id}.json"`
    }
  });
}
