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

export function placeScenarioTile(
  grid: Cell[][],
  row: number,
  column: number,
  tile: Cell
): Cell[][] {
  return grid.map((currentRow, rowIndex) =>
    currentRow.map((cell, columnIndex) =>
      rowIndex === row && columnIndex === column ? cloneCell(tile) : cell
    )
  );
}

export function scenarioTileLabel(tile: Cell): string {
  if (tile === null) return "Empty";
  if (tile.t === "n") return `Number ${tile.v}`;
  if (tile.t === "z") return "Zero";
  if (tile.t === "w") return `Wildcard times ${tile.m}`;
  return "Lock-0";
}

function cloneCell(cell: Cell): Cell {
  return cell === null ? null : { ...cell };
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
