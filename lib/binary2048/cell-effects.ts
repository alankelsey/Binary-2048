type Tile = { t: "n"; v: number } | { t: "z" } | { t: "w"; m: number };
type Cell = Tile | null;

export type CellEffect = "merge-number" | "merge-wild" | "zero-bust" | "spawn";

export type MoveEvent = {
  type?: string;
  at?: [number, number];
};

export type MoveDir = "up" | "down" | "left" | "right";

type EffectsState = {
  width: number;
  height: number;
  grid: Cell[][];
};

export function computeCellEffects(
  prev: EffectsState,
  next: EffectsState,
  events: MoveEvent[],
  dir?: MoveDir
): Record<string, CellEffect> {
  const effects: Record<string, CellEffect> = {};
  const prevZeroCount = prev.grid.flat().filter((cell) => cell?.t === "z").length;
  const nextZeroCount = next.grid.flat().filter((cell) => cell?.t === "z").length;
  const prevWildCount = prev.grid.flat().filter((cell) => cell?.t === "w").length;
  const nextWildCount = next.grid.flat().filter((cell) => cell?.t === "w").length;
  const hasMergeEvent = events.some((event) => event?.type === "merge");
  const spawnKeys = new Set(
    events
      .filter((event) => event?.type === "spawn" && Array.isArray(event?.at))
      .map((event) => `${event.at?.[0]}-${event.at?.[1]}`)
  );
  const zeroCollisionCount = Math.max(0, prevZeroCount - nextZeroCount);
  const wildCollisionCount = Math.max(0, prevWildCount - nextWildCount);
  const changedNumberCells: string[] = [];
  const changedOccupiedCells: string[] = [];
  const removedZeroCells: string[] = [];
  const removedWildCells: string[] = [];
  const zeroImpactTargetCells = dir ? computeZeroImpactTargets(prev, dir) : [];

  const tileChanged = (before: Cell, after: Cell) => {
    if (!before && !after) return false;
    if (!before || !after) return true;
    if (before.t !== after.t) return true;
    if (before.t === "n" && after.t === "n") return before.v !== after.v;
    if (before.t === "w" && after.t === "w") return before.m !== after.m;
    return false;
  };

  for (let r = 0; r < next.height; r++) {
    for (let c = 0; c < next.width; c++) {
      const key = `${r}-${c}`;
      const before = prev.grid[r]?.[c] ?? null;
      const after = next.grid[r]?.[c] ?? null;

      if (spawnKeys.has(key) && after) effects[key] = "spawn";
      if (before?.t === "z" && after?.t !== "z") removedZeroCells.push(key);
      if (before?.t === "w" && after?.t !== "w") removedWildCells.push(key);

      if (after && tileChanged(before, after) && !spawnKeys.has(key)) {
        changedOccupiedCells.push(key);
        if (after.t === "n") changedNumberCells.push(key);
      }

      if (!hasMergeEvent || !after || spawnKeys.has(key)) continue;
      if (after.t === "w") {
        if (before?.t !== "w" || before.m !== after.m) effects[key] = "merge-wild";
        continue;
      }
      if (after.t === "n") {
        if (before?.t !== "n" || before.v !== after.v) effects[key] = "merge-number";
      }
    }
  }

  if (wildCollisionCount > 0) {
    let assigned = 0;
    for (const key of changedNumberCells) {
      effects[key] = "merge-wild";
      assigned += 1;
      if (assigned >= wildCollisionCount) break;
    }
    if (assigned < wildCollisionCount) {
      for (const key of removedWildCells) {
        if (effects[key]) continue;
        effects[key] = "merge-wild";
        assigned += 1;
        if (assigned >= wildCollisionCount) break;
      }
    }
  }

  if (zeroCollisionCount > 0) {
    let assigned = 0;
    // Direction-aware first choice: actual collision destination tile(s).
    if (assigned < zeroCollisionCount) {
      for (const key of zeroImpactTargetCells) {
        if (effects[key] === "spawn") continue;
        effects[key] = "zero-bust";
        assigned += 1;
        if (assigned >= zeroCollisionCount) break;
      }
    }
    // Then fall back to changed numeric destinations.
    if (assigned < zeroCollisionCount) {
      for (const key of changedNumberCells) {
        if (spawnKeys.has(key) || effects[key] === "spawn") continue;
        effects[key] = "zero-bust";
        assigned += 1;
        if (assigned >= zeroCollisionCount) break;
      }
    }
    if (assigned < zeroCollisionCount) {
      for (const key of changedOccupiedCells) {
        if (effects[key]) continue;
        effects[key] = "zero-bust";
        assigned += 1;
        if (assigned >= zeroCollisionCount) break;
      }
    }
  }
  return effects;
}

function computeZeroImpactTargets(state: EffectsState, dir: MoveDir): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const lines = extractLines(state.grid, dir);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const compact = line.filter((cell) => cell !== null) as Tile[];
    let i = 0;
    let outIndex = 0;

    while (i < compact.length) {
      const a = compact[i] as Tile;
      const b = compact[i + 1] as Tile | undefined;
      if (b && canMergeForEffects(a, b)) {
        const merged = mergePairForEffects(a, b);
        if ((a.t === "z" || b.t === "z") && merged?.t === "n") {
          const key = outputIndexToGridKey(state, dir, lineIndex, outIndex);
          if (!seen.has(key)) {
            seen.add(key);
            out.push(key);
          }
        }
        i += 2;
        outIndex += 1;
      } else {
        i += 1;
        outIndex += 1;
      }
    }
  }

  return out;
}

function outputIndexToGridKey(state: EffectsState, dir: MoveDir, lineIndex: number, outIndex: number): string {
  const h = state.height;
  const w = state.width;
  if (dir === "left") return `${lineIndex}-${outIndex}`;
  if (dir === "right") return `${lineIndex}-${w - 1 - outIndex}`;
  if (dir === "up") return `${outIndex}-${lineIndex}`;
  return `${h - 1 - outIndex}-${lineIndex}`;
}

function extractLines(grid: Cell[][], dir: MoveDir): Cell[][] {
  const h = grid.length;
  const w = grid[0].length;
  const lines: Cell[][] = [];

  if (dir === "left") {
    for (let r = 0; r < h; r++) lines.push([...grid[r]]);
  } else if (dir === "right") {
    for (let r = 0; r < h; r++) lines.push([...grid[r]].reverse());
  } else if (dir === "up") {
    for (let c = 0; c < w; c++) {
      const col: Cell[] = [];
      for (let r = 0; r < h; r++) col.push(grid[r][c]);
      lines.push(col);
    }
  } else {
    for (let c = 0; c < w; c++) {
      const col: Cell[] = [];
      for (let r = 0; r < h; r++) col.push(grid[r][c]);
      lines.push(col.reverse());
    }
  }
  return lines;
}

function canMergeForEffects(a: Tile, b: Tile): boolean {
  if (a.t === "z" || b.t === "z") return true;
  if (a.t === "n" && b.t === "n") return a.v === b.v;
  if (a.t === "w" && b.t === "w") return a.m === b.m;
  if ((a.t === "w" && b.t === "n") || (a.t === "n" && b.t === "w")) return true;
  return false;
}

function mergePairForEffects(a: Tile, b: Tile): Tile | null {
  if (a.t === "z" && b.t === "z") return null;
  if ((a.t === "z" && b.t === "w") || (a.t === "w" && b.t === "z")) return null;
  if (a.t === "z") return b;
  if (b.t === "z") return a;
  if (a.t === "n" && b.t === "n") return { t: "n", v: a.v * 2 };
  if (a.t === "w" && b.t === "w") return { t: "w", m: a.m * 2 };
  if (a.t === "w" && b.t === "n") return { t: "n", v: b.v * a.m };
  if (a.t === "n" && b.t === "w") return { t: "n", v: a.v * b.m };
  return a;
}
