import type { GameExport, GameState } from "@/lib/binary2048/types";

export type ReplayData = Pick<GameExport, "initial" | "steps" | "final">;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGameState(value: unknown): value is GameState {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    Array.isArray(value.grid) &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.score === "number" &&
    typeof value.turn === "number" &&
    typeof value.won === "boolean" &&
    typeof value.over === "boolean"
  );
}

export function parseReplayExport(value: unknown): ReplayData | null {
  if (!isObject(value)) return null;
  if (!isGameState(value.initial) || !isGameState(value.final)) return null;
  if (!Array.isArray(value.steps)) return null;
  return {
    initial: value.initial,
    steps: value.steps as ReplayData["steps"],
    final: value.final
  };
}

export function replayStateAtStep(replay: ReplayData, step: number): GameState {
  if (step <= 0) return replay.initial;
  if (step >= replay.steps.length) return replay.final;
  return replay.steps[step - 1].after;
}
