import { NextResponse } from "next/server";
import { asyncMatchStandings, getAsyncMatch } from "@/lib/binary2048/async-pvp";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const match = getAsyncMatch(id);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  return NextResponse.json(
    {
      match,
      standings: asyncMatchStandings(match)
    },
    { status: 200 }
  );
}
