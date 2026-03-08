/**
 * training-data.ts
 *
 * Server-side helpers for the /api/training/* endpoints.
 *
 * DESIGN NOTES (for ML practitioners reading this source):
 *
 *  - No persistent store is required. All replay records are generated
 *    deterministically from (seed, bot) pairs, so page=1 always returns
 *    the same rows. This is intentional: it means the training API works
 *    immediately in the in-memory deployment without Mongo.
 *
 *  - Label generation uses the game engine's applyMove() directly so we
 *    get exact 1-step lookahead values without spinning up an HTTP server.
 *    The "rollout" strategy extends this with short random rollouts.
 *
 *  - The flat_state encoding is the same as GET /api/games/:id/encoded
 *    (flattenEncodedState), so Python code can use either source interchangeably.
 */

import { applyMove, createGame } from "@/lib/binary2048/engine";
import { parseAction, type ActionCode } from "@/lib/binary2048/action";
import {
  ACTION_SPACE,
  actionMask,
  encodeState,
  flattenEncodedState,
  legalActionCodes
} from "@/lib/binary2048/ai";
import { runBotTournament, type BotId } from "@/lib/binary2048/bot-orchestrator";
import type { Dir, GameState } from "@/lib/binary2048/types";

// ---------------------------------------------------------------------------
// Replays
// ---------------------------------------------------------------------------

export type TrainingReplayRecord = {
  seed: number;
  bot: BotId;
  final_score: number;
  max_tile: number;
  turns: number;
  engine_version: string;
};

export type TrainingReplaysResult = {
  data: TrainingReplayRecord[];
  page: number;
  limit: number;
  count: number;
};

function maxTileFromState(state: GameState): number {
  let max = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell?.t === "n") max = Math.max(max, cell.v);
    }
  }
  return max;
}

/**
 * generateTrainingReplays
 *
 * Runs `limit` bot games starting from seed = (page-1)*limit + 1.
 * Results are fully deterministic — same page always returns same rows.
 *
 * @param page    1-based page number
 * @param limit   rows per page (max 100)
 * @param bot     which built-in bot to use
 * @param minScore only include runs with final_score >= minScore
 * @param engineVersion injected from process.env by the route handler
 */
export function generateTrainingReplays(
  page: number,
  limit: number,
  bot: BotId,
  minScore: number,
  engineVersion: string
): TrainingReplaysResult {
  const clampedLimit = Math.min(Math.max(1, limit), 100);
  const clampedPage = Math.max(1, page);

  // Derive seed range from page so results are stable across calls.
  const seedStart = (clampedPage - 1) * clampedLimit + 1;
  const seeds = Array.from({ length: clampedLimit }, (_, i) => seedStart + i);

  // runBotTournament already handles full games for multiple seeds + bots.
  const result = runBotTournament({
    seeds,
    maxMoves: 2000,
    bots: [bot]
  });

  const data: TrainingReplayRecord[] = result.runs
    .filter((run) => run.score >= minScore)
    .map((run) => ({
      seed: run.seed,
      bot: run.bot,
      final_score: run.score,
      max_tile: run.maxTile,
      turns: run.moves,
      engine_version: engineVersion
    }));

  return {
    data,
    page: clampedPage,
    limit: clampedLimit,
    count: data.length
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export type LabelStrategy = "score_delta" | "rollout";

export type TrainingLabelRecord = {
  /**
   * 32-element float array: [type0, value0, type1, value1, ...] for all 16 cells.
   * Same encoding as GET /api/games/:id/encoded → encodedFlat.
   */
  flat_state: number[];
  /**
   * 4-element [0|1] mask aligned to ["L","R","U","D"].
   * 1 = legal move, 0 = illegal (would be a no-op).
   */
  action_mask: number[];
  /**
   * Index into ["L","R","U","D"] for the labeled best action.
   *   0 = L (left)
   *   1 = R (right)
   *   2 = U (up)
   *   3 = D (down)
   */
  best_action: number;
  /**
   * Heuristic confidence in the label (0–1).
   * score_delta: 0.6 (simple 1-step heuristic)
   * rollout: depends on score spread across candidates
   */
  confidence: number;
  /** How the label was generated */
  source: LabelStrategy;
};

export type TrainingLabelsResult = {
  data: TrainingLabelRecord[];
  page: number;
  limit: number;
  count: number;
};

/** Seeded pseudo-random for rollout bot (mulberry32, same as bot-orchestrator) */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Runs a single random rollout from `start` for `depth` steps.
 * Returns the terminal score (used to rank candidate moves).
 */
function randomRollout(start: GameState, rand: () => number, depth: number): number {
  let current = start;
  for (let i = 0; i < depth; i++) {
    if (current.over || current.won) break;
    const legal = legalActionCodes(current);
    if (legal.length === 0) break;
    const code = legal[Math.floor(rand() * legal.length)];
    if (!code) break;
    const dir = parseAction(code) as Dir | null;
    if (!dir) break;
    current = applyMove(current, dir).state;
  }
  return current.score;
}

/**
 * Pick the best action from a state using 1-step score-delta lookahead.
 * Fast: O(numLegalMoves) engine calls, no rollouts.
 * Returns { bestAction, confidence }.
 */
function labelByScoreDelta(
  state: GameState,
  legalActions: ActionCode[]
): { bestAction: ActionCode; confidence: number } {
  let bestScore = -Infinity;
  let bestAction = legalActions[0]!;

  for (const action of legalActions) {
    const dir = parseAction(action) as Dir | null;
    if (!dir) continue;
    const result = applyMove(state, dir);
    const delta = result.state.score - state.score;
    if (delta > bestScore) {
      bestScore = delta;
      bestAction = action;
    }
  }

  // Confidence is heuristic: 0.6 for 1-step lookahead (acknowledged to be weak
  // when multiple moves tie at delta=0, which is common early game).
  return { bestAction, confidence: 0.6 };
}

/**
 * Pick the best action using short random rollouts from each candidate.
 * Slower but much more reliable than score_delta for zero-delta opening moves.
 * Returns { bestAction, confidence }.
 *
 * confidence = 1 - (secondBestAvg / bestAvg) clamped to [0, 1].
 * When one move dominates all others, confidence approaches 1.
 * When two moves tie, confidence approaches 0.
 */
function labelByRollout(
  state: GameState,
  legalActions: ActionCode[],
  rand: () => number,
  rolloutsPerAction = 8,
  rolloutDepth = 15
): { bestAction: ActionCode; confidence: number } {
  const scores: Record<string, number> = {};

  for (const action of legalActions) {
    const dir = parseAction(action) as Dir | null;
    if (!dir) continue;
    const afterFirst = applyMove(state, dir).state;
    let total = afterFirst.score;
    for (let i = 0; i < rolloutsPerAction; i++) {
      total += randomRollout(afterFirst, rand, rolloutDepth);
    }
    scores[action] = total / (rolloutsPerAction + 1);
  }

  const sorted = [...legalActions].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  const bestAction = sorted[0] ?? legalActions[0]!;
  const bestAvg = scores[bestAction] ?? 0;
  const secondAvg = sorted[1] ? (scores[sorted[1]] ?? 0) : 0;

  const confidence = bestAvg > 0 ? Math.min(1, 1 - secondAvg / bestAvg) : 0.5;

  return { bestAction, confidence: Number(confidence.toFixed(4)) };
}

/**
 * generateTrainingLabels
 *
 * Runs `gamesPerPage` games starting from a deterministic seed offset,
 * records every step as a labeled (flat_state, action_mask, best_action) tuple,
 * then returns `limit` of those tuples paginated.
 *
 * The game is driven forward by the `score_delta` policy (greedy 1-step),
 * which produces a reasonable range of board states. The labeling strategy
 * (score_delta or rollout) is applied independently and only affects the
 * `best_action` column — not the choice used to advance the game.
 *
 * @param page       1-based page number
 * @param limit      labels to return per page (max 500)
 * @param strategy   how to label each step's best action
 * @param minTile    only include labels from games that reached this tile value
 */
export function generateTrainingLabels(
  page: number,
  limit: number,
  strategy: LabelStrategy,
  minTile: number
): TrainingLabelsResult {
  const clampedLimit = Math.min(Math.max(1, limit), 500);
  const clampedPage = Math.max(1, page);

  // Each page collects from a fresh set of seeds. We run enough games to have
  // a comfortable surplus before applying the minTile filter.
  const gamesPerBatch = Math.max(10, Math.ceil(clampedLimit / 20));
  const seedOffset = (clampedPage - 1) * gamesPerBatch + 1;

  const allLabels: TrainingLabelRecord[] = [];

  for (let gameIdx = 0; gameIdx < gamesPerBatch && allLabels.length < clampedLimit * 3; gameIdx++) {
    const seed = seedOffset + gameIdx;
    const { state: initial } = createGame({ seed });
    let current = initial;

    // Track the highest tile reached so we can apply minTile filter at the end.
    let gamePeak = 0;
    const gameLabels: TrainingLabelRecord[] = [];
    const rand = mulberry32(seed ^ 0xdeadbeef);

    for (let step = 0; step < 2000; step++) {
      if (current.over || current.won) break;
      const legal = legalActionCodes(current);
      if (legal.length === 0) break;

      const flatState = flattenEncodedState(encodeState(current));
      const mask = actionMask(legal);

      let bestAction: ActionCode;
      let confidence: number;

      if (strategy === "score_delta") {
        ({ bestAction, confidence } = labelByScoreDelta(current, legal));
      } else {
        ({ bestAction, confidence } = labelByRollout(current, legal, rand));
      }

      gameLabels.push({
        flat_state: flatState,
        action_mask: mask,
        best_action: ACTION_SPACE.indexOf(bestAction),
        confidence,
        source: strategy
      });

      // Advance game using score_delta policy (consistent regardless of label strategy).
      const { bestAction: advanceAction } = labelByScoreDelta(current, legal);
      const dir = parseAction(advanceAction) as Dir | null;
      if (!dir) break;
      const moved = applyMove(current, dir);
      current = moved.state;

      // Track max tile for minTile filter.
      for (const row of current.grid) {
        for (const cell of row) {
          if (cell?.t === "n") gamePeak = Math.max(gamePeak, cell.v);
        }
      }
    }

    // Apply minTile filter: include labels from this game only if it reached the threshold.
    if (gamePeak >= minTile) {
      allLabels.push(...gameLabels);
    }
  }

  const data = allLabels.slice(0, clampedLimit);
  return {
    data,
    page: clampedPage,
    limit: clampedLimit,
    count: data.length
  };
}
