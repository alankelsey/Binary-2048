import { NextResponse } from "next/server";
import { listSessionState } from "@/lib/binary2048/sessions";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const state = listSessionState(id);
  if (!state) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  return NextResponse.json(state);
}
