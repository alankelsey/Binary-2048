import { NextResponse } from "next/server";
import { buildReplayPostmortem } from "@/lib/binary2048/replay-postmortem";
import { parseJsonWithLimit, RequestBodyTooLargeError } from "@/lib/binary2048/request-body-limit";

const MAX_REPLAY_POSTMORTEM_BODY_BYTES = 128 * 1024;

export async function POST(req: Request) {
  try {
    const body = await parseJsonWithLimit(req, MAX_REPLAY_POSTMORTEM_BODY_BYTES);
    const result = buildReplayPostmortem(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid replay postmortem request" },
      { status: 400 }
    );
  }
}
