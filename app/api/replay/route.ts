import { NextResponse } from "next/server";
import { runReplay } from "@/lib/binary2048/replay-run";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = runReplay(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid replay request" },
      { status: 400 }
    );
  }
}
