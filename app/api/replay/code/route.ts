import { NextResponse } from "next/server";
import { createReplayCode, parseReplayCode } from "@/lib/binary2048/replay-code";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signingSecret = process.env.BINARY2048_REPLAY_CODE_SECRET;
    const result = createReplayCode(body, signingSecret);
    return NextResponse.json({
      code: result.code,
      length: result.length,
      maxLength: 3500,
      overLimit: result.overLimit,
      compressed: result.compressed,
      signed: result.signed
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
    const signingSecret = process.env.BINARY2048_REPLAY_CODE_SECRET;
    const payload = parseReplayCode(code ?? "", signingSecret);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid replay code" },
      { status: 400 }
    );
  }
}
