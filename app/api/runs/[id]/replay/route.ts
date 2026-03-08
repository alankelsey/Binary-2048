import { NextResponse } from "next/server";
import { getRunStore } from "@/lib/binary2048/run-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const replay = await getRunStore().getRunReplay(id);
  if (!replay) {
    return NextResponse.json({ error: "Run replay not found" }, { status: 404 });
  }
  return NextResponse.json(replay);
}
