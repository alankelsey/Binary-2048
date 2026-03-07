import { NextResponse } from "next/server";
import { runScenario } from "@/lib/binary2048/engine";
import { parseJsonWithLimit, RequestBodyTooLargeError } from "@/lib/binary2048/request-body-limit";
import type { Cell, Dir, GameConfig } from "@/lib/binary2048/types";

const MAX_SIM_RUN_BODY_BYTES = 128 * 1024;

export async function POST(req: Request) {
  try {
    const body = await parseJsonWithLimit<{
      config: GameConfig;
      initialGrid: Cell[][];
      moves: Dir[];
    }>(req, MAX_SIM_RUN_BODY_BYTES);
    const exported = runScenario(body.config, body.initialGrid, body.moves);
    return NextResponse.json(exported);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid simulation request" },
      { status: 400 }
    );
  }
}
