import { NextResponse } from "next/server";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig } from "@/lib/binary2048/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      config: GameConfig;
      initialGrid: Cell[][];
      moves: Dir[];
    };
    const exported = runScenario(body.config, body.initialGrid, body.moves);
    return NextResponse.json(exported);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid simulation request" },
      { status: 400 }
    );
  }
}
