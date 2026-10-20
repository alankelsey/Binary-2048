import type { GameState } from "@/lib/binary2048/types";
import type { ReplayData } from "@/lib/binary2048/replay";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGameState(value: unknown): value is GameState {
  if (!isObject(value)) return false;
  return typeof value.id === "string" && Array.isArray(value.grid) &&
    typeof value.width === "number" && typeof value.height === "number" &&
    typeof value.score === "number" && typeof value.turn === "number" &&
    typeof value.won === "boolean" && typeof value.over === "boolean";
}

export function parseReplayExport(value: unknown): ReplayData | null {
  if (!isObject(value) || !isGameState(value.initial) || !isGameState(value.final) || !Array.isArray(value.steps)) return null;
  return { initial: value.initial, steps: value.steps as ReplayData["steps"], final: value.final };
}
