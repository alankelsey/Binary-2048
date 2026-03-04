import { NextResponse } from "next/server";
import { createReplayCode, parseReplayCode } from "@/lib/binary2048/replay-code";
import { createHostedReplayCode, isHostedReplayCode, parseHostedReplayCode } from "@/lib/binary2048/replay-hosted-code";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signingSecret = process.env.BINARY2048_REPLAY_CODE_SECRET;
    const hostedSecret = process.env.BINARY2048_REPLAY_SHARE_SECRET || signingSecret;
    const result = createReplayCode(body, signingSecret);
    if (result.overLimit && hostedSecret) {
      const hosted = createHostedReplayCode(result.payload, hostedSecret);
      return NextResponse.json({
        code: hosted.code,
        length: hosted.code.length,
        maxLength: 3500,
        overLimit: false,
        compressed: result.compressed,
        signed: true,
        hosted: true,
        expiresAt: new Date(hosted.expiresAt).toISOString()
      });
    }
    return NextResponse.json({
      code: result.code,
      length: result.length,
      maxLength: 3500,
      overLimit: result.overLimit,
      compressed: result.compressed,
      signed: result.signed,
      hosted: false
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
    const hostedSecret = process.env.BINARY2048_REPLAY_SHARE_SECRET || signingSecret;
    const payload = isHostedReplayCode(code ?? "")
      ? parseHostedReplayCode(code ?? "", hostedSecret ?? "")
      : parseReplayCode(code ?? "", signingSecret);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid replay code" },
      { status: 400 }
    );
  }
}
