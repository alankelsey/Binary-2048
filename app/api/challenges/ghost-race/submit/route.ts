import { NextResponse } from "next/server";
import { submitGhostRaceReplay } from "@/lib/binary2048/ghost-race";
import { parseJsonWithLimit, RequestBodyTooLargeError } from "@/lib/binary2048/request-body-limit";

const MAX_GHOST_SUBMIT_BODY_BYTES = 128 * 1024;

type SubmitBody = {
  playerId?: string;
  replay?: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await parseJsonWithLimit(req, MAX_GHOST_SUBMIT_BODY_BYTES)) as SubmitBody;
    if (!body.playerId || typeof body.playerId !== "string") {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }
    if (!body.replay) {
      return NextResponse.json({ error: "replay is required" }, { status: 400 });
    }
    const submitted = submitGhostRaceReplay(body.playerId, body.replay);
    return NextResponse.json({ submitted: true, result: submitted });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit ghost race replay" },
      { status: 400 }
    );
  }
}
