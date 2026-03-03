import { simulateBatch, type SimulateBatchRequest, type SimulateBatchResult } from "@/lib/binary2048/simulate";
import type { AnyAction } from "@/lib/binary2048/action";
import type { Cell, GameConfig, GameExport } from "@/lib/binary2048/types";

export type ReplayHeader = {
  replayVersion?: number;
  rulesetId?: string;
  engineVersion?: string;
  size?: number;
  seed?: number;
  createdAt?: string;
};

export type ReplayRunRequest = {
  header?: ReplayHeader;
  config?: Partial<GameConfig> & { size?: number };
  initialGrid?: Cell[][];
  moves?: AnyAction[];
  includeSteps?: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGameExportPayload(value: unknown): value is GameExport {
  if (!isObject(value)) return false;
  return (
    typeof value.version === "number" &&
    isObject(value.config) &&
    isObject(value.initial) &&
    Array.isArray((value.initial as { grid?: unknown }).grid)
  );
}

function fromExport(payload: GameExport): SimulateBatchRequest {
  const moves = payload.meta?.replay?.moves ?? payload.steps.map((step) => step.dir);
  return {
    seed: payload.meta?.replay?.seed ?? payload.config.seed,
    moves,
    config: payload.config,
    initialGrid: payload.initial.grid,
    includeSteps: true
  };
}

function fromReplayRequest(payload: ReplayRunRequest): SimulateBatchRequest {
  if (!payload.moves || !Array.isArray(payload.moves) || payload.moves.length === 0) {
    throw new Error("moves must be a non-empty array");
  }
  if (!payload.initialGrid || !Array.isArray(payload.initialGrid)) {
    throw new Error("initialGrid is required for replay reconstruction");
  }

  if (payload.header?.rulesetId && payload.header.rulesetId !== "binary2048-v1") {
    throw new Error(`Unsupported rulesetId: ${payload.header.rulesetId}`);
  }

  const seed = payload.header?.seed ?? payload.config?.seed;
  return {
    seed,
    moves: payload.moves,
    config: payload.config,
    initialGrid: payload.initialGrid,
    includeSteps: payload.includeSteps ?? true
  };
}

export function runReplay(payload: unknown): SimulateBatchResult {
  if (isGameExportPayload(payload)) {
    return simulateBatch(fromExport(payload));
  }
  if (!isObject(payload)) throw new Error("Invalid replay payload");
  return simulateBatch(fromReplayRequest(payload as ReplayRunRequest));
}
