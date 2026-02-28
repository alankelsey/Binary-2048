import { NextResponse } from "next/server";
import { createSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = ((raw && typeof raw === "object" ? raw : {}) as {
      config?: Partial<GameConfig>;
      initialGrid?: Cell[][];
    });
    const session = createSession(body.config, body.initialGrid);
    return NextResponse.json({
      id: session.current.id,
      current: session.current,
      steps: session.steps
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create game" },
      { status: 400 }
    );
  }
}
