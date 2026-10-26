import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

export type ScenarioGameMode = "classic" | "bitstorm";

export type ScenarioBuilderState = {
  config: GameConfig;
  gameMode: ScenarioGameMode;
  grid: Cell[][];
};

export function createEmptyScenarioGrid(height: number, width: number): Cell[][] {
  return Array.from({ length: height }, () => Array<Cell>(width).fill(null));
}

export function resizeScenarioGrid(grid: Cell[][], height: number, width: number): Cell[][] {
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, column) => grid[row]?.[column] ?? null)
  );
}

export function createScenarioBuilderState(initialGrid?: Cell[][]): ScenarioBuilderState {
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    spawn: {
      ...DEFAULT_CONFIG.spawn,
      wildcardMultipliers: [...DEFAULT_CONFIG.spawn.wildcardMultipliers]
    }
  };

  return {
    config,
    gameMode: "classic",
    grid: initialGrid
      ? resizeScenarioGrid(initialGrid, config.height, config.width)
      : createEmptyScenarioGrid(config.height, config.width)
  };
}
