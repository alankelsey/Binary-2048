import { NextResponse } from "next/server";
import { DEFAULT_CONFIG, generateBitstormInitialGrid } from "@/lib/binary2048/engine";
import { createSession } from "@/lib/binary2048/sessions";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = ((raw && typeof raw === "object" ? raw : {}) as {
      config?: Partial<GameConfig>;
      initialGrid?: Cell[][];
      mode?: "classic" | "bitstorm";
    });
    let config = body.config;
    let initialGrid = body.initialGrid;
    const mode = body.mode === "bitstorm" ? "bitstorm" : "classic";

    if (!initialGrid && mode === "bitstorm") {
      const merged: GameConfig = {
        ...DEFAULT_CONFIG,
        ...(config ?? {}),
        spawn: {
          ...DEFAULT_CONFIG.spawn,
          ...(config?.spawn ?? {})
        }
      };
      const seeded = config?.seed === undefined ? Math.floor(Math.random() * 2147483647) + 1 : config.seed;
      const effectiveConfig: GameConfig = { ...merged, seed: seeded };
      initialGrid = generateBitstormInitialGrid(effectiveConfig);
      config = effectiveConfig;
    }

    const session = createSession(config, initialGrid);
    return NextResponse.json({
      id: session.current.id,
      current: session.current,
      steps: session.steps,
      mode
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create game" },
      { status: 400 }
    );
  }
}
