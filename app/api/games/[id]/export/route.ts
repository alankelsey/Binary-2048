import { NextResponse } from "next/server";
import { exportToCompactReplay } from "@/lib/binary2048/replay-format";
import { buildReplayAudit } from "@/lib/binary2048/replay-audit";
import { createReplaySignature } from "@/lib/binary2048/replay-signature";
import { exportSession } from "@/lib/binary2048/sessions";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const exported = exportSession(id);
  if (!exported) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  const url = new URL(req.url);
  const compact = url.searchParams.get("compact");
  const wantsCompact = compact === "1" || compact === "true";
  const audit = url.searchParams.get("audit");
  const wantsAudit = audit === "1" || audit === "true";

  if (wantsAudit) {
    exported.meta.audit = buildReplayAudit(exported);
  }
  const replay = exportToCompactReplay(exported);
  const signingSecret = process.env.BINARY2048_REPLAY_CODE_SECRET ?? "";
  const signature = signingSecret ? createReplaySignature(replay, signingSecret) : undefined;
  if (signature) {
    exported.meta.replay.signature = signature;
  }

  if (wantsCompact) {
    return NextResponse.json({
      header: replay.header,
      moves: replay.moves,
      signature
    });
  }

  return new NextResponse(JSON.stringify({ ...exported, signature }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${id}.json"`
    }
  });
}
