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
 * Response shape:
 *   flat_state   number[32]  — same encoding as /api/games/:id/encoded → encodedFlat
 *   action_mask  number[4]   — [L, R, U, D] legality flags (1=legal, 0=illegal)
 *   best_action  number      — index into ["L","R","U","D"] (0=L,1=R,2=U,3=D)
 *   confidence   number      — heuristic label quality score 0–1
 *   source       string      — "score_delta" | "rollout"
 */

import { NextResponse } from "next/server";
import { generateTrainingLabels, type LabelStrategy } from "@/lib/binary2048/training-data";

const ALLOWED_STRATEGIES: LabelStrategy[] = ["score_delta", "rollout"];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
    const minTile = Math.max(0, parseInt(searchParams.get("minTile") ?? "0", 10) || 0);

    const rawStrategy = searchParams.get("strategy") ?? "score_delta";
    const strategy: LabelStrategy = ALLOWED_STRATEGIES.includes(rawStrategy as LabelStrategy)
      ? (rawStrategy as LabelStrategy)
      : "score_delta";

    const result = generateTrainingLabels(page, limit, strategy, minTile);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate label data" },
      { status: 500 }
    );
  }
}
