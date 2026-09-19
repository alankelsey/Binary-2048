import type { Dir, GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDir(value: unknown): value is Dir {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

function isFullGameExport(value: unknown): value is GameExport {
  if (!isObject(value) || typeof value.version !== "number") return false;
  if (!isObject(value.meta) || !isObject(value.config) || !isObject(value.initial)) return false;
  return Array.isArray(value.initial.grid) && Array.isArray(value.steps);
}

export function toGameImportPayload(value: unknown): unknown {
  if (!isFullGameExport(value)) return value;

  const replayMoves = value.meta?.replay?.moves;
  const moves = Array.isArray(replayMoves) ? replayMoves : value.steps.map((step) => step.dir);
  if (!moves.every(isDir)) {
    throw new Error("Export contains invalid move direction");
  }

  const compact: SessionRecoverySnapshot = {
    recoveryVersion: 1,
    rulesetId: "binary2048-v1",
    config: value.config,
    initialGrid: value.initial.grid,
    moves
  };
  return compact;
}

export function getGameImportErrorMessage(status: number, serverError?: unknown): string {
  if (status === 403) {
    return "Import was blocked by site security (HTTP 403). Please retry; if it continues, contact support.";
  }
  if (status === 413) {
    return "Import file is too large.";
  }
  return typeof serverError === "string" && serverError.trim().length > 0
    ? serverError
    : "Failed to import game";
}
