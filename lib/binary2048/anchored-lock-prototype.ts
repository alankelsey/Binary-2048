import type { Cell, Dir, Tile } from "@/lib/binary2048/types";

export type AnchoredLockMove = {
  grid: Cell[][];
  moved: boolean;
  gainedScore: number;
};

export const ANCHORED_LOCK_COLLISIONS_TO_REMOVE = 2;

export type AnchoredLockPrototypeState = {
  grid: Cell[][];
  lockCollisions: Record<string, number>;
};

export type AnchoredLockLifecycleStep = {
  state: AnchoredLockPrototypeState;
  tileMotion: boolean;
  gridChanged: boolean;
  gainedScore: number;
  collisions: Array<[number, number]>;
  removedLocks: Array<[number, number]>;
};

/**
 * Experimental, non-production line resolver for the anchored Lock-0 spike.
 * The line is oriented so movement is toward index 0. Lock cells retain their
 * indexes and each non-lock segment resolves independently.
 */
export function resolveAnchoredLockLine(line: Cell[]): Omit<AnchoredLockMove, "grid"> & { line: Cell[] } {
  const output = cloneLine(line);
  let segmentStart = 0;
  let gainedScore = 0;

  for (let index = 0; index <= line.length; index += 1) {
    if (index < line.length && line[index]?.t !== "i") continue;
    const segment = resolveSegment(line.slice(segmentStart, index));
    output.splice(segmentStart, segment.line.length, ...segment.line);
    gainedScore += segment.gainedScore;
    if (index < line.length) output[index] = { t: "i" };
    segmentStart = index + 1;
  }

  return {
    line: output,
    moved: serialize(line) !== serialize(output),
    gainedScore
  };
}

/**
 * Resolves one experimental swipe without turn advancement, spawning,
 * lifecycle/despawn, win, or game-over behavior. Those semantics remain later
 * decision gates in the spike.
 */
export function previewAnchoredLockMove(grid: Cell[][], direction: Dir): AnchoredLockMove {
  assertRectangularGrid(grid);
  const lines = extractOrientedLines(grid, direction);
  let moved = false;
  let gainedScore = 0;
  const resolved = lines.map((line) => {
    const result = resolveAnchoredLockLine(line);
    moved ||= result.moved;
    gainedScore += result.gainedScore;
    return result.line;
  });
  return { grid: writeOrientedLines(grid, direction, resolved), moved, gainedScore };
}

export function createAnchoredLockPrototypeState(grid: Cell[][]): AnchoredLockPrototypeState {
  assertRectangularGrid(grid);
  const lockCollisions: Record<string, number> = {};
  for (const [rowIndex, row] of grid.entries()) {
    for (const [columnIndex, cell] of row.entries()) {
      if (cell?.t === "i") lockCollisions[coordinateKey(rowIndex, columnIndex)] = 0;
    }
  }
  return { grid: grid.map(cloneLine), lockCollisions };
}

/**
 * Candidate lifecycle for the experimental spike. Every non-lock tile kind can
 * collide. A lock records collisions independently and is removed after its
 * second collision, but only after the current swipe has resolved against the
 * still-active partition.
 */
export function advanceAnchoredLockLifecycle(
  state: AnchoredLockPrototypeState,
  direction: Dir
): AnchoredLockLifecycleStep {
  assertRectangularGrid(state.grid);
  const movement = previewAnchoredLockMove(state.grid, direction);
  const collisions = findLockCollisions(state.grid, direction);
  const nextCounts = { ...state.lockCollisions };
  const removedLocks: Array<[number, number]> = [];

  for (const [row, column] of collisions) {
    const key = coordinateKey(row, column);
    const collisionCount = (nextCounts[key] ?? 0) + 1;
    if (collisionCount >= ANCHORED_LOCK_COLLISIONS_TO_REMOVE) {
      removedLocks.push([row, column]);
      delete nextCounts[key];
    } else {
      nextCounts[key] = collisionCount;
    }
  }

  const nextGrid = movement.grid.map(cloneLine);
  for (const [row, column] of removedLocks) nextGrid[row][column] = null;

  return {
    state: { grid: nextGrid, lockCollisions: nextCounts },
    tileMotion: movement.moved,
    gridChanged: movement.moved || removedLocks.length > 0,
    gainedScore: movement.gainedScore,
    collisions,
    removedLocks
  };
}

function resolveSegment(line: Cell[]): { line: Cell[]; gainedScore: number } {
  const compact = line.filter((cell): cell is Tile => cell !== null);
  const output: Cell[] = [];
  let gainedScore = 0;

  for (let index = 0; index < compact.length;) {
    const left = compact[index];
    const right = compact[index + 1];
    if (right && canMerge(left, right)) {
      const merged = mergePair(left, right);
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
  return { line: output, gainedScore };
}

function canMerge(left: Tile, right: Tile): boolean {
  if (left.t === "i" || right.t === "i") return false;
  if (left.t === "z" || right.t === "z") return true;
  if (left.t === "n" && right.t === "n") return left.v === right.v;
  if (left.t === "w" && right.t === "w") return left.m === right.m;
  return (left.t === "w" && right.t === "n") || (left.t === "n" && right.t === "w");
}

function mergePair(left: Tile, right: Tile): Tile | null {
  if (left.t === "i" || right.t === "i") throw new Error("Anchored locks must partition before segment merging");
  if (left.t === "z" && right.t === "z") return null;
  if ((left.t === "z" && right.t === "w") || (left.t === "w" && right.t === "z")) return null;
  if (left.t === "z") return { ...right };
  if (right.t === "z") return { ...left };
  if (left.t === "n" && right.t === "n") return { t: "n", v: left.v * 2 };
  if (left.t === "w" && right.t === "w") return { t: "w", m: left.m * 2 };
  if (left.t === "w" && right.t === "n") return { t: "n", v: right.v * left.m };
  if (left.t === "n" && right.t === "w") return { t: "n", v: left.v * right.m };
  throw new Error("Tiles cannot merge");
}

function pointsForMerge(tile: Tile): number {
  if (tile.t === "n") return tile.v;
  if (tile.t === "w") return tile.m;
  return 0;
}

function extractOrientedLines(grid: Cell[][], direction: Dir): Cell[][] {
  if (direction === "left") return grid.map(cloneLine);
  if (direction === "right") return grid.map((row) => cloneLine(row).reverse());
  const width = grid[0].length;
  return Array.from({ length: width }, (_, column) => {
    const line = grid.map((row) => cloneCell(row[column]));
    return direction === "up" ? line : line.reverse();
  });
}

function writeOrientedLines(source: Cell[][], direction: Dir, lines: Cell[][]): Cell[][] {
  const output = source.map(cloneLine);
  if (direction === "left" || direction === "right") {
    return lines.map((line) => direction === "left" ? cloneLine(line) : cloneLine(line).reverse());
  }
  for (let column = 0; column < lines.length; column += 1) {
    const line = direction === "up" ? lines[column] : cloneLine(lines[column]).reverse();
    for (let row = 0; row < output.length; row += 1) output[row][column] = cloneCell(line[row]);
  }
  return output;
}

function assertRectangularGrid(grid: Cell[][]) {
  if (grid.length === 0 || grid[0].length === 0) throw new Error("Prototype grid must not be empty");
  const width = grid[0].length;
  if (grid.some((row) => row.length !== width)) throw new Error("Prototype grid must be rectangular");
}

function findLockCollisions(grid: Cell[][], direction: Dir): Array<[number, number]> {
  const incomingDelta: Record<Dir, [number, number]> = {
    left: [0, 1],
    right: [0, -1],
    up: [1, 0],
    down: [-1, 0]
  };
  const collisions: Array<[number, number]> = [];
  for (const [rowIndex, row] of grid.entries()) {
    for (const [columnIndex, cell] of row.entries()) {
      if (cell?.t !== "i") continue;
      const [rowDelta, columnDelta] = incomingDelta[direction];
      let rowCursor = rowIndex + rowDelta;
      let columnCursor = columnIndex + columnDelta;
      while (
        rowCursor >= 0 && rowCursor < grid.length &&
        columnCursor >= 0 && columnCursor < grid[0].length
      ) {
        const candidate = grid[rowCursor][columnCursor];
        if (candidate?.t === "i") break;
        if (candidate !== null) {
          collisions.push([rowIndex, columnIndex]);
          break;
        }
        rowCursor += rowDelta;
        columnCursor += columnDelta;
      }
    }
  }
  return collisions;
}

function coordinateKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function cloneCell(cell: Cell): Cell {
  return cell === null ? null : { ...cell };
}

function cloneLine(line: Cell[]): Cell[] {
  return line.map(cloneCell);
}

function serialize(line: Cell[]): string {
  return JSON.stringify(line);
}
