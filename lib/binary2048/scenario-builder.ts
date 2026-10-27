import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

export type ScenarioGameMode = "classic" | "bitstorm";
export type ScenarioSymmetry = "none" | "horizontal" | "vertical" | "rotational" | "four-way";

export type ScenarioBuilderState = {
  config: GameConfig;
  gameMode: ScenarioGameMode;
  symmetry: ScenarioSymmetry;
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
  tile: Cell,
  symmetry: ScenarioSymmetry = "none"
): Cell[][] {
  const coordinates = new Set(
    scenarioSymmetryCoordinates(grid.length, grid[0]?.length ?? 0, row, column, symmetry)
      .map(([targetRow, targetColumn]) => `${targetRow}:${targetColumn}`)
  );
  return grid.map((currentRow, rowIndex) =>
    currentRow.map((cell, columnIndex) =>
      coordinates.has(`${rowIndex}:${columnIndex}`) ? cloneCell(tile) : cell
    )
  );
}

export function scenarioSymmetryCoordinates(
  height: number,
  width: number,
  row: number,
  column: number,
  symmetry: ScenarioSymmetry
): Array<[number, number]> {
  const horizontal: [number, number] = [row, width - column - 1];
  const vertical: [number, number] = [height - row - 1, column];
  const rotational: [number, number] = [height - row - 1, width - column - 1];
  const candidates: Array<[number, number]> = [[row, column]];
  if (symmetry === "horizontal" || symmetry === "four-way") candidates.push(horizontal);
  if (symmetry === "vertical" || symmetry === "four-way") candidates.push(vertical);
  if (symmetry === "rotational" || symmetry === "four-way") candidates.push(rotational);

  return candidates.filter(
    ([candidateRow, candidateColumn], index) =>
      candidates.findIndex(([seenRow, seenColumn]) =>
        seenRow === candidateRow && seenColumn === candidateColumn
      ) === index
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
    symmetry: "none",
    grid: initialGrid
      ? resizeScenarioGrid(initialGrid, config.height, config.width)
      : createEmptyScenarioGrid(config.height, config.width)
  };
}
