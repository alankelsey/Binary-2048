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
 *
 * Rate limit: BINARY2048_RATE_LIMIT_TRAINING_MAX per BINARY2048_RATE_LIMIT_WINDOW_MS
 * (defaults: 20 requests / 5 minutes per client)
 */

import { NextResponse } from "next/server";
import { evaluateChallenge } from "@/lib/binary2048/challenge-policy";
import { recordRouteTelemetry } from "@/lib/binary2048/ops-telemetry";
import { checkTrainingRateLimit, rateLimitHeaders, type RateLimitResult } from "@/lib/binary2048/rate-limit";
import { generateTrainingReplays } from "@/lib/binary2048/training-data";
import {
  acquireTrainingSlot,
  getTrainingQueueStats,
  resolveTrainingQueueOptions,
  TrainingQueueFullError,
  TrainingQueueTimeoutError,
  type TrainingQueueSlot
} from "@/lib/binary2048/training-queue";
import type { BotId } from "@/lib/binary2048/bot-orchestrator";

const ENGINE_VERSION = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";
const ALLOWED_BOTS: BotId[] = ["priority", "random", "alternate", "rollout"];

export async function GET(req: Request) {
  const startedAtMs = Date.now();
  let statusCode = 200;
  let quota: RateLimitResult | null = null;
  let slot: TrainingQueueSlot | null = null;
  try {
    const challenge = evaluateChallenge({ req, route: "/api/training/replays", risk: "high", userTier: "guest" });
    if (!challenge.allowed) {
      statusCode = 403;
      return NextResponse.json(
        { error: "Challenge required", route: "/api/training/replays", reason: challenge.reason, mode: challenge.mode },
        { status: 403 }
      );
    }

    quota = await checkTrainingRateLimit(req);
    if (!quota.allowed) {
      statusCode = 429;
      return NextResponse.json(
        { error: "Rate limit exceeded", route: "training", limit: quota.limit, remaining: quota.remaining, retryAfterSeconds: quota.retryAfterSeconds },
        { status: 429, headers: rateLimitHeaders(quota) }
      );
    }

    slot = await acquireTrainingSlot(resolveTrainingQueueOptions());
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const minScore = Math.max(0, parseInt(searchParams.get("minScore") ?? "0", 10) || 0);

    const rawBot = searchParams.get("bot") ?? "rollout";
    const bot: BotId = ALLOWED_BOTS.includes(rawBot as BotId) ? (rawBot as BotId) : "rollout";

    const result = generateTrainingReplays(page, limit, bot, minScore, ENGINE_VERSION);
    return NextResponse.json(
      { ...result, queue: getTrainingQueueStats() },
      { headers: rateLimitHeaders(quota) }
    );
  } catch (error) {
    const headers = quota ? rateLimitHeaders(quota) : undefined;
    if (error instanceof TrainingQueueFullError || error instanceof TrainingQueueTimeoutError) {
      statusCode = 503;
      return NextResponse.json(
        {
          error: error instanceof TrainingQueueFullError ? "Training capacity reached" : "Training queue wait timeout",
          code: error instanceof TrainingQueueFullError ? "queue_full" : "queue_timeout",
          queue: getTrainingQueueStats()
        },
        { status: 503, headers: { ...headers, "Retry-After": "5" } }
      );
    }
    statusCode = 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate replay data" },
      { status: 500, headers }
    );
  } finally {
    slot?.release();
    recordRouteTelemetry({ route: "/api/training/replays", status: statusCode, durationMs: Date.now() - startedAtMs, costUnits: 5 });
  }
}
