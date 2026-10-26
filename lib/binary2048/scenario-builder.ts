import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

export type ScenarioGameMode = "classic" | "bitstorm";

export type ScenarioBuilderState = {
  config: GameConfig;
  gameMode: ScenarioGameMode;
  grid: Cell[][];
};

export type ScenarioGridHistory = {
  past: Cell[][][];
  present: Cell[][];
  future: Cell[][][];
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

export function createScenarioGridHistory(grid: Cell[][]): ScenarioGridHistory {
  return { past: [], present: cloneGrid(grid), future: [] };
}

export function commitScenarioGrid(
  history: ScenarioGridHistory,
  grid: Cell[][]
): ScenarioGridHistory {
  if (scenarioGridsEqual(history.present, grid)) return history;
  return {
    past: [...history.past, cloneGrid(history.present)],
    present: cloneGrid(grid),
    future: []
  };
}

export function undoScenarioGrid(history: ScenarioGridHistory): ScenarioGridHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: cloneGrid(previous),
    future: [cloneGrid(history.present), ...history.future]
  };
}

export function redoScenarioGrid(history: ScenarioGridHistory): ScenarioGridHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, cloneGrid(history.present)],
    present: cloneGrid(next),
    future: history.future.slice(1)
  };
}

export function scenarioGridsEqual(left: Cell[][], right: Cell[][]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map(cloneCell));
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
