import { NextResponse } from "next/server";
import { createReplayCode, parseReplayCode } from "@/lib/binary2048/replay-code";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = createReplayCode(body);
    return NextResponse.json({
      code: result.code,
      length: result.length,
      maxLength: 3500,
      overLimit: result.overLimit,
      compressed: result.compressed
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid replay payload" },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  try {
    const payload = parseReplayCode(code ?? "");
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid replay code" },
      { status: 400 }
    );
  }
}
