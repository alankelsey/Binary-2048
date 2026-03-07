import { parseAction, toActionCode } from "@/lib/binary2048/action";
import { applyMove, runScenario } from "@/lib/binary2048/engine";
import { toCompactReplayPayload } from "@/lib/binary2048/replay-format";
import type { Dir, StepRecord } from "@/lib/binary2048/types";

export type ReplayPostmortemEntry = {
  turn: number;
  chosen: ReturnType<typeof toActionCode>;
  moved: boolean;
  chosenScoreDelta: number;
  bestAction: ReturnType<typeof toActionCode> | null;
  bestScoreDelta: number;
  opportunityCost: number;
};

export type ReplayPostmortem = {
  analyzedMoves: number;
  topCostlyMoves: ReplayPostmortemEntry[];
};

function stepScoreDelta(step: StepRecord) {
  return step.after.score - step.before.score;
}

function bestImmediateDelta(step: StepRecord) {
  const candidates: Array<{ dir: Dir; delta: number }> = [];
  const dirs: Dir[] = ["up", "left", "right", "down"];
  for (const dir of dirs) {
    const next = applyMove(step.before, dir).state;
    const delta = next.score - step.before.score;
    candidates.push({ dir, delta });
  }
  candidates.sort((a, b) => b.delta - a.delta);
  return candidates[0] ?? null;
}

function toEntry(step: StepRecord): ReplayPostmortemEntry {
  const chosenDelta = stepScoreDelta(step);
  const best = bestImmediateDelta(step);
  const noopPenalty = step.moved ? 0 : 50;
  const bestDelta = best?.delta ?? chosenDelta;
  const opportunityCost = Math.max(0, bestDelta - chosenDelta) + noopPenalty;
  return {
    turn: step.turn,
    chosen: toActionCode(step.dir),
    moved: step.moved,
    chosenScoreDelta: chosenDelta,
    bestAction: best ? toActionCode(best.dir) : null,
    bestScoreDelta: bestDelta,
    opportunityCost
  };
}

export function buildReplayPostmortem(payload: unknown, top = 5): ReplayPostmortem {
  const compact = toCompactReplayPayload(payload);
  const moves = compact.moves
    .map((move) => parseAction(move))
    .filter((dir): dir is Dir => dir !== null);
  const replay = runScenario(compact.config, compact.initialGrid, moves);
  const entries = replay.steps.map(toEntry).sort((a, b) => b.opportunityCost - a.opportunityCost || a.turn - b.turn);
  return {
    analyzedMoves: replay.steps.length,
    topCostlyMoves: entries.slice(0, Math.max(1, top))
  };
}
