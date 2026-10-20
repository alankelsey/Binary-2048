import type { GameExport, GameState } from "@/lib/binary2048/types";

export type ReplayData = Pick<GameExport, "initial" | "steps" | "final">;

export function replayStateAtStep(replay: ReplayData, step: number): GameState {
  if (step <= 0) return replay.initial;
  if (step >= replay.steps.length) return replay.final;
  return replay.steps[step - 1].after;
}
