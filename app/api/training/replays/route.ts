/**
 * GET /api/training/replays
 *
 * Returns paginated deterministic bot replay records for ML training pipelines.
 *
 * Seeds are derived from page number so the same page always returns the same
 * data — no persistent storage required. This means the endpoint is safe to
 * call repeatedly from a Python training loop without warming up a database.
 *
 * Query parameters:
 *   page      (int, default 1)    — 1-based page number
 *   limit     (int, default 20)   — rows per page, max 100
 *   bot       (string)            — priority | random | alternate | rollout (default rollout)
 *   minScore  (int, default 0)    — only include runs with final_score >= minScore
 */

import { NextResponse } from "next/server";
import { generateTrainingReplays } from "@/lib/binary2048/training-data";
import type { BotId } from "@/lib/binary2048/bot-orchestrator";

const ENGINE_VERSION = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";
const ALLOWED_BOTS: BotId[] = ["priority", "random", "alternate", "rollout"];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const minScore = Math.max(0, parseInt(searchParams.get("minScore") ?? "0", 10) || 0);

    const rawBot = searchParams.get("bot") ?? "rollout";
    const bot: BotId = ALLOWED_BOTS.includes(rawBot as BotId) ? (rawBot as BotId) : "rollout";

    const result = generateTrainingReplays(page, limit, bot, minScore, ENGINE_VERSION);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate replay data" },
      { status: 500 }
    );
  }
}
