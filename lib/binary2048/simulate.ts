import { applyMove, createGame, DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameState, Tile } from "@/lib/binary2048/types";

export type SimulateStepSummary = {
  turn: number;
  dir: Dir;
  changed: boolean;
  reward: number;
  done: boolean;
  spawned: { r: number; c: number; tile: Tile } | null;
};

export type SimulateBatchRequest = {
  seed?: number;
  moves: Dir[];
  config?: Partial<GameConfig> & { size?: number };
  initialGrid?: Cell[][];
  includeSteps?: boolean;
};

export type SimulateBatchResult = {
  rulesetId: "binary2048-v1";
  seed: number;
  initial: GameState;
  final: GameState;
  totalScore: number;
  totalReward: number;
  movesApplied: number;
  stepSummaries: SimulateStepSummary[];
};

function mergeConfig(config: SimulateBatchRequest["config"], seed?: number): GameConfig {
  const size = typeof config?.size === "number" && config.size >= 2 ? Math.floor(config.size) : undefined;
  const merged: GameConfig = {
    ...DEFAULT_CONFIG,
    ...(config ?? {}),
    width: size ?? config?.width ?? DEFAULT_CONFIG.width,
    height: size ?? config?.height ?? DEFAULT_CONFIG.height,
    seed: seed ?? config?.seed ?? DEFAULT_CONFIG.seed,
    spawn: {
      ...DEFAULT_CONFIG.spawn,
      ...(config?.spawn ?? {})
    }
  };
  return merged;
}

function firstSpawn(events: Array<{ type: string; at?: [number, number]; tile?: Tile }>): SimulateStepSummary["spawned"] {
  const spawn = events.find((event) => event.type === "spawn");
  if (!spawn || !spawn.at || !spawn.tile) return null;
  return { r: spawn.at[0], c: spawn.at[1], tile: spawn.tile };
}

export function simulateBatch(req: SimulateBatchRequest): SimulateBatchResult {
  if (!Array.isArray(req.moves) || req.moves.length === 0) {
    throw new Error("moves must be a non-empty array");
  }
  for (const move of req.moves) {
    if (move !== "up" && move !== "down" && move !== "left" && move !== "right") {
      throw new Error(`Invalid move direction: ${String(move)}`);
    }
  }

  const config = mergeConfig(req.config, req.seed);
  const created = createGame(config, req.initialGrid);
  const initial = created.state;
  let current = initial;
  let totalReward = 0;
  const stepSummaries: SimulateStepSummary[] = [];

  for (const dir of req.moves) {
    const beforeScore = current.score;
    const moved = applyMove(current, dir);
    const reward = moved.state.score - beforeScore;
    const done = moved.state.over || moved.state.won;

    stepSummaries.push({
      turn: moved.state.turn,
      dir,
      changed: moved.moved,
      reward,
      done,
      spawned: firstSpawn(moved.events as Array<{ type: string; at?: [number, number]; tile?: Tile }>)
    });

    totalReward += reward;
    current = moved.state;
    if (done) break;
  }

  return {
    rulesetId: "binary2048-v1",
    seed: config.seed,
    initial,
    final: current,
    totalScore: current.score,
    totalReward,
    movesApplied: stepSummaries.length,
    stepSummaries: req.includeSteps === false ? [] : stepSummaries
  };
}
