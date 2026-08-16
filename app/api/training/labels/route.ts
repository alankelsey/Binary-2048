/**
 * GET /api/training/labels
 *
 * Returns per-step (flat_state, action_mask, best_action) tuples for supervised
 * pretraining of RL agents. Each row is one board position with the "correct"
 * action labeled.
 *
 * This is useful for behavioural cloning — training a network to imitate a
 * known policy before switching to self-play RL. It converges faster than
 * pure RL from scratch and produces a better starting checkpoint.
 *
 * Query parameters:
 *   page      (int, default 1)          — 1-based page number
 *   limit     (int, default 100)        — rows to return, max 500
 *   strategy  (string, default score_delta)
 *               score_delta — label = move with highest immediate score gain
 *               rollout     — label = move with best average rollout outcome
 *   minTile   (int, default 0)          — only include steps from games that
 *               reached this tile value or higher (e.g. 128 for mid-game data)
 *
 * Rate limit: shared training bucket — BINARY2048_RATE_LIMIT_TRAINING_MAX per
 * BINARY2048_RATE_LIMIT_WINDOW_MS (defaults: 20 requests / 5 minutes per client)
 *
 * Response shape:
 *   flat_state   number[32]  — same encoding as /api/games/:id/encoded → encodedFlat
 *   action_mask  number[4]   — [L, R, U, D] legality flags (1=legal, 0=illegal)
 *   best_action  number      — index into ["L","R","U","D"] (0=L,1=R,2=U,3=D)
 *   confidence   number      — heuristic label quality score 0–1
 *   source       string      — "score_delta" | "rollout"
 */

import { NextResponse } from "next/server";
import { evaluateChallenge } from "@/lib/binary2048/challenge-policy";
import { recordRouteTelemetry } from "@/lib/binary2048/ops-telemetry";
import { checkTrainingRateLimit, rateLimitHeaders, type RateLimitResult } from "@/lib/binary2048/rate-limit";
import { generateTrainingLabels, type LabelStrategy } from "@/lib/binary2048/training-data";
import {
  acquireTrainingSlot,
  getTrainingQueueStats,
  resolveTrainingQueueOptions,
  TrainingQueueFullError,
  TrainingQueueTimeoutError,
  type TrainingQueueSlot
} from "@/lib/binary2048/training-queue";

const ALLOWED_STRATEGIES: LabelStrategy[] = ["score_delta", "rollout"];

export async function GET(req: Request) {
  const startedAtMs = Date.now();
  let statusCode = 200;
  let quota: RateLimitResult | null = null;
  let slot: TrainingQueueSlot | null = null;
  try {
    const challenge = evaluateChallenge({ req, route: "/api/training/labels", risk: "high", userTier: "guest" });
    if (!challenge.allowed) {
      statusCode = 403;
      return NextResponse.json(
        { error: "Challenge required", route: "/api/training/labels", reason: challenge.reason, mode: challenge.mode },
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
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
    const minTile = Math.max(0, parseInt(searchParams.get("minTile") ?? "0", 10) || 0);

    const rawStrategy = searchParams.get("strategy") ?? "score_delta";
    const strategy: LabelStrategy = ALLOWED_STRATEGIES.includes(rawStrategy as LabelStrategy)
      ? (rawStrategy as LabelStrategy)
      : "score_delta";

    const result = generateTrainingLabels(page, limit, strategy, minTile);
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
      { error: error instanceof Error ? error.message : "Failed to generate label data" },
      { status: 500, headers }
    );
  } finally {
    slot?.release();
    recordRouteTelemetry({ route: "/api/training/labels", status: statusCode, durationMs: Date.now() - startedAtMs, costUnits: 3 });
  }
}
