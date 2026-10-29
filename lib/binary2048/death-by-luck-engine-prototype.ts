import { parseDeathByLuckDefinition, type DeathByLuckDefinition } from "@/lib/binary2048/death-by-luck-prototype";
import type { Cell, Dir, Tile } from "@/lib/binary2048/types";

export type DeathByLuckMovePreview = {
  grid: Cell[][];
  moved: boolean;
  gainedScore: number;
};

export function resolveDeathByLuckLine(
  definition: DeathByLuckDefinition,
  line: Cell[],
  turn = 0
): { line: Cell[]; moved: boolean; gainedScore: number } {
  parseDeathByLuckDefinition(definition);
  const compact = line.filter((cell): cell is Tile => cell !== null);
  const output: Cell[] = [];
  let gainedScore = 0;

  for (let index = 0; index < compact.length;) {
    const left = compact[index];
    const right = compact[index + 1];
    if (right && canMerge(left, right, turn)) {
      const merged = mergePair(left, right, turn);
      if (merged) {
        output.push(merged);
        gainedScore += pointsForMerge(merged);
      }
      index += 2;
    } else {
      output.push({ ...left });
      index += 1;
    }
  }

  while (output.length < line.length) output.push(null);
  return {
    line: output,
    moved: JSON.stringify(output) !== JSON.stringify(line),
    gainedScore
  };
}

export function previewDeathByLuckMove(
  definition: DeathByLuckDefinition,
  grid: Cell[][],
  direction: Dir,
  turn = 0
): DeathByLuckMovePreview {
  parseDeathByLuckDefinition(definition);
  assertRectangularGrid(grid, definition);
  const lines = extractLines(grid, direction);
  let moved = false;
  let gainedScore = 0;
  const resolved = lines.map((line) => {
    const result = resolveDeathByLuckLine(definition, line, turn);
    moved ||= result.moved;
    gainedScore += result.gainedScore;
    return result.line;
  });
  return { grid: writeLines(grid, direction, resolved), moved, gainedScore };
}

function canMerge(left: Tile, right: Tile, turn: number): boolean {
  if (left.t === "w" && right.t === "w") return false;
  if ((left.t === "i" || right.t === "i") && turn % 2 === 0) return false;
  const normalizedLeft = asZeroOnBreakTurn(left, turn);
  const normalizedRight = asZeroOnBreakTurn(right, turn);
  if (normalizedLeft.t === "z" || normalizedRight.t === "z") return true;
  if (normalizedLeft.t === "n" && normalizedRight.t === "n") return normalizedLeft.v === normalizedRight.v;
  return (normalizedLeft.t === "w" && normalizedRight.t === "n") ||
    (normalizedLeft.t === "n" && normalizedRight.t === "w");
}

function mergePair(leftTile: Tile, rightTile: Tile, turn: number): Tile | null {
  if (!canMerge(leftTile, rightTile, turn)) throw new Error("Death by Luck tiles cannot merge");
  const left = asZeroOnBreakTurn(leftTile, turn);
  const right = asZeroOnBreakTurn(rightTile, turn);
  if (left.t === "z" && right.t === "z") return null;
  if ((left.t === "z" && right.t === "w") || (left.t === "w" && right.t === "z")) return null;
  if (left.t === "z") return { ...right };
  if (right.t === "z") return { ...left };
  if (left.t === "n" && right.t === "n") return { t: "n", v: left.v * 2 };
  if (left.t === "w" && right.t === "n") return { t: "n", v: right.v * left.m };
  if (left.t === "n" && right.t === "w") return { t: "n", v: left.v * right.m };
  throw new Error("Death by Luck merge is unsupported");
}

function asZeroOnBreakTurn(tile: Tile, turn: number): Tile {
  return tile.t === "i" && turn % 2 === 1 ? { t: "z" } : tile;
}

function pointsForMerge(tile: Tile): number {
  if (tile.t === "n") return tile.v;
  if (tile.t === "w") return tile.m;
  return 0;
}

function assertRectangularGrid(grid: Cell[][], definition: DeathByLuckDefinition) {
  if (grid.length !== definition.config.height || grid.some((row) => row.length !== definition.config.width)) {
    throw new Error("Death by Luck grid dimensions must match its definition");
  }
}

function extractLines(grid: Cell[][], direction: Dir): Cell[][] {
  if (direction === "left") return grid.map(cloneLine);
  if (direction === "right") return grid.map((row) => cloneLine(row).reverse());
  return Array.from({ length: grid[0].length }, (_, column) => {
    const line = grid.map((row) => cloneCell(row[column]));
    return direction === "up" ? line : line.reverse();
  });
}

function writeLines(source: Cell[][], direction: Dir, lines: Cell[][]): Cell[][] {
  if (direction === "left") return lines.map(cloneLine);
  if (direction === "right") return lines.map((line) => cloneLine(line).reverse());
  const output = source.map(cloneLine);
  for (let column = 0; column < lines.length; column += 1) {
    const line = direction === "up" ? lines[column] : cloneLine(lines[column]).reverse();
    for (let row = 0; row < output.length; row += 1) output[row][column] = cloneCell(line[row]);
  }
  return output;
}

function cloneCell(cell: Cell): Cell {
  return cell === null ? null : { ...cell };
}

function cloneLine(line: Cell[]): Cell[] {
  return line.map(cloneCell);
}
