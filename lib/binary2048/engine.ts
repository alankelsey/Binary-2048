import type {
  Cell,
  Coord,
  Dir,
  GameConfig,
  GameEvent,
  GameExport,
  GameState,
  StepRecord,
  Tile
} from "@/lib/binary2048/types";

let idCounter = 1;

export const DEFAULT_CONFIG: GameConfig = {
  width: 4,
  height: 4,
  seed: 42,
  winTile: 2048,
  zeroBehavior: "annihilate",
  spawnOnNoopMove: false,
  spawn: {
    pZero: 0.15,
    pOne: 0.75,
    pWildcard: 0.1,
    wildcardMultipliers: [2, 4, 8]
  }
};

export function createGame(
  partialConfig?: Partial<GameConfig>,
  initialGrid?: Cell[][]
): { state: GameState; events: GameEvent[] } {
  const config = mergeConfig(partialConfig);
  validateConfig(config);
  const normalizedInitialGrid = normalizeInitialGrid(initialGrid, config);
  const events: GameEvent[] = [];
  const state: GameState = {
    id: `g_${idCounter++}`,
    config,
    width: config.width,
    height: config.height,
    seed: config.seed,
    rngStep: 0,
    score: 0,
    turn: 0,
    won: false,
    over: false,
    grid: normalizedInitialGrid ? cloneGrid(normalizedInitialGrid) : newEmptyGrid(config.height, config.width)
  };
  const withSpawns = normalizedInitialGrid ? state : spawnN(state, 2, events);
  return { state: updateWinLose(withSpawns, events), events };
}

export function applyMove(state: GameState, dir: Dir): { state: GameState; moved: boolean; events: GameEvent[] } {
  if (state.over) return { state, moved: false, events: [] };

  const before = cloneState(state);
  const events: GameEvent[] = [];
  const lines = extractLines(before.grid, dir);
  const nextLines: Cell[][] = [];
  let moved = false;
  let gainedScore = 0;

  for (const line of lines) {
    const { line: out, changed, gainedScore: lineScore } = resolveLine(line, events);
    nextLines.push(out);
    if (changed) moved = true;
    gainedScore += lineScore;
  }

  let next = cloneState(before);
  next.grid = writeLines(before.grid, dir, nextLines);
  next.turn += 1;
  next.score += gainedScore;

  if (moved || next.config.spawnOnNoopMove) {
    next = spawnN(next, 1, events);
  }

  next = updateWinLose(next, events);
  return { state: next, moved, events };
}

export function runScenario(config: GameConfig, initialGrid: Cell[][], moves: Dir[]): GameExport {
  validateConfig(config);
  let current = createGame(config, initialGrid).state;
  const initial = cloneState(current);
  const steps: StepRecord[] = [];

  for (const dir of moves) {
    const before = cloneState(current);
    const move = applyMove(current, dir);
    const after = move.state;
    steps.push({ turn: before.turn + 1, dir, moved: move.moved, before, after: cloneState(after), events: move.events });
    current = after;
    if (current.over) break;
  }

  return buildExport(config, initial, steps, current);
}

export function buildExport(
  config: GameConfig,
  initial: GameState,
  steps: StepRecord[],
  final: GameState
): GameExport {
  return {
    version: 1,
    meta: { createdAtISO: new Date().toISOString(), engine: "binary-2048" },
    config,
    initial,
    steps,
    final
  };
}

function mergeConfig(partial: Partial<GameConfig> | undefined): GameConfig {
  if (!partial) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    spawn: {
      ...DEFAULT_CONFIG.spawn,
      ...(partial.spawn ?? {})
    }
  };
}

function validateConfig(config: GameConfig) {
  if (config.width < 2 || config.height < 2) throw new Error("Grid too small");
  const s = config.spawn.pZero + config.spawn.pOne + config.spawn.pWildcard;
  if (Math.abs(s - 1) > 1e-6) throw new Error("Spawn probabilities must sum to 1");
  if (!config.spawn.wildcardMultipliers.length) throw new Error("wildcardMultipliers cannot be empty");
}

function normalizeInitialGrid(initialGrid: Cell[][] | undefined, config: GameConfig): Cell[][] | undefined {
  if (initialGrid === undefined || initialGrid === null) return undefined;
  if (!Array.isArray(initialGrid) || initialGrid.length === 0) {
    throw new Error("initialGrid must be a non-empty 2D array when provided");
  }
  if (initialGrid.length !== config.height) {
    throw new Error(`initialGrid height must match config.height (${config.height})`);
  }
  for (const row of initialGrid) {
    if (!Array.isArray(row) || row.length !== config.width) {
      throw new Error(`each initialGrid row must have config.width (${config.width}) cells`);
    }
  }
  return initialGrid;
}

function resolveLine(line: Cell[], events: GameEvent[]): { line: Cell[]; changed: boolean; gainedScore: number } {
  const compact = line.filter((c) => c !== null);
  const out: Cell[] = [];
  let i = 0;
  let gainedScore = 0;

  while (i < compact.length) {
    const a = compact[i] as Tile;
    const b = compact[i + 1] as Tile | undefined;
    if (b && canMerge(a, b)) {
      const merged = mergePair(a, b);
      if (merged) {
        out.push(merged);
        events.push({ type: "merge", at: [-1, -1], into: merged });
        gainedScore += pointsForMerge(merged);
      }
      i += 2;
    } else {
      out.push(a);
      i += 1;
    }
  }

  while (out.length < line.length) out.push(null);
  const changed = serializeLine(line) !== serializeLine(out);
  return { line: out, changed, gainedScore };
}

function pointsForMerge(tile: Tile): number {
  if (tile.t === "n") return tile.v;
  if (tile.t === "w") return tile.m;
  return 0;
}

function canMerge(a: Tile, b: Tile): boolean {
  if (a.t === "z" || b.t === "z") return true;
  if (a.t === "n" && b.t === "n") return a.v === b.v;
  if (a.t === "w" && b.t === "w") return a.m === b.m;
  if ((a.t === "w" && b.t === "n") || (a.t === "n" && b.t === "w")) return true;
  return false;
}

function mergePair(a: Tile, b: Tile): Tile | null {
  if (a.t === "z" && b.t === "z") return null;
  if (a.t === "z") return b;
  if (b.t === "z") return a;
  if (a.t === "n" && b.t === "n") return { t: "n", v: a.v * 2 };
  if (a.t === "w" && b.t === "w") return { t: "w", m: a.m * 2 };
  if (a.t === "w" && b.t === "n") return { t: "n", v: b.v * a.m };
  if (a.t === "n" && b.t === "w") return { t: "n", v: a.v * b.m };
  return a;
}

function spawnN(state: GameState, n: number, events: GameEvent[]): GameState {
  let out = cloneState(state);
  for (let i = 0; i < n; i++) {
    const empties = getEmptyCoords(out.grid);
    if (!empties.length) break;
    const { value: idx, state: s1 } = nextInt(out, empties.length);
    const at = empties[idx];
    const { tile, state: s2 } = sampleSpawnTile(s1);
    out = cloneState(s2);
    out.grid[at[0]][at[1]] = tile;
    events.push({ type: "spawn", at, tile });
  }
  return out;
}

function sampleSpawnTile(state: GameState): { tile: Tile; state: GameState } {
  const a = nextRand(state);
  const pz = state.config.spawn.pZero;
  const po = pz + state.config.spawn.pOne;
  if (a.value < pz) return { tile: { t: "z" }, state: a.state };
  if (a.value < po) return { tile: { t: "n", v: 1 }, state: a.state };

  const b = nextInt(a.state, state.config.spawn.wildcardMultipliers.length);
  return {
    tile: { t: "w", m: state.config.spawn.wildcardMultipliers[b.value] },
    state: b.state
  };
}

function updateWinLose(state: GameState, events: GameEvent[]): GameState {
  const out = cloneState(state);
  if (!out.won) {
    for (let r = 0; r < out.height; r++) {
      for (let c = 0; c < out.width; c++) {
        const cell = out.grid[r][c];
        if (cell?.t === "n" && cell.v >= out.config.winTile) {
          out.won = true;
          events.push({ type: "game_won", at: [r, c], tile: cell });
          break;
        }
      }
      if (out.won) break;
    }
  }
  if (isGameOver(out.grid)) {
    out.over = true;
    events.push({ type: "game_over" });
  }
  return out;
}

function isGameOver(grid: Cell[][]): boolean {
  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) return false;
  if (getEmptyCoords(grid).length > 0) return false;
  const h = grid.length;
  const w = grid[0].length;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const cur = grid[r][c];
      const right = c + 1 < w ? grid[r][c + 1] : null;
      const down = r + 1 < h ? grid[r + 1][c] : null;
      if (cur && right && canMerge(cur, right)) return false;
      if (cur && down && canMerge(cur, down)) return false;
    }
  }
  return true;
}

function extractLines(grid: Cell[][], dir: Dir): Cell[][] {
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

function writeLines(grid: Cell[][], dir: Dir, lines: Cell[][]): Cell[][] {
  const h = grid.length;
  const w = grid[0].length;
  const out = newEmptyGrid(h, w);

  if (dir === "left") {
    for (let r = 0; r < h; r++) out[r] = [...lines[r]];
  } else if (dir === "right") {
    for (let r = 0; r < h; r++) out[r] = [...lines[r]].reverse();
  } else if (dir === "up") {
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < h; r++) out[r][c] = lines[c][r];
    }
  } else {
    for (let c = 0; c < w; c++) {
      const col = [...lines[c]].reverse();
      for (let r = 0; r < h; r++) out[r][c] = col[r];
    }
  }
  return out;
}

function getEmptyCoords(grid: Cell[][]): Coord[] {
  const out: Coord[] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === null) out.push([r, c]);
    }
  }
  return out;
}

function nextRand(state: GameState): { value: number; state: GameState } {
  const value = randomUnit(state.seed, state.rngStep);
  const out = cloneState(state);
  out.rngStep += 1;
  return { value, state: out };
}

function nextInt(state: GameState, max: number): { value: number; state: GameState } {
  const v = nextRand(state);
  return { value: Math.floor(v.value * max), state: v.state };
}

function randomUnit(seed: number, step: number): number {
  let x = (seed ^ (Math.imul(step + 1, 747796405) + 2891336453)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 2246822519) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 3266489917) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x >>> 0) / 4294967296;
}

function newEmptyGrid(height: number, width: number): Cell[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
}

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    config: {
      ...state.config,
      spawn: {
        ...state.config.spawn,
        wildcardMultipliers: [...state.config.spawn.wildcardMultipliers]
      }
    },
    grid: cloneGrid(state.grid)
  };
}

function serializeLine(line: Cell[]): string {
  return line
    .map((c) => {
      if (!c) return "_";
      if (c.t === "n") return `n${c.v}`;
      if (c.t === "w") return `w${c.m}`;
      return "z";
    })
    .join("|");
}
