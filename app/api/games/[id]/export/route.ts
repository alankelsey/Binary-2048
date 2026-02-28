import { NextResponse } from "next/server";
import { exportSession } from "@/lib/binary2048/sessions";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const exported = exportSession(id);
  if (!exported) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  return new NextResponse(JSON.stringify(exported, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${id}.json"`
    }
  });
}
