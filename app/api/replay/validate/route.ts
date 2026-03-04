import { NextResponse } from "next/server";
import { validateReplay } from "@/lib/binary2048/replay-validate";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = validateReplay(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "Invalid replay payload" },
      { status: 400 }
    );
  }
}
