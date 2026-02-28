export type NumberTile = { t: "n"; v: number };
export type ZeroTile = { t: "z" };
export type WildcardTile = { t: "w"; m: number };
export type Tile = NumberTile | ZeroTile | WildcardTile;
export type Cell = Tile | null;
export type Dir = "up" | "down" | "left" | "right";
export type Coord = [number, number];

export type SpawnConfig = {
  pZero: number;
  pOne: number;
  pWildcard: number;
  wildcardMultipliers: number[];
};

export type GameConfig = {
  width: number;
  height: number;
  seed: number;
  winTile: number;
  zeroBehavior: "annihilate";
  spawnOnNoopMove: boolean;
  spawn: SpawnConfig;
};

export type GameEvent =
  | { type: "spawn"; at: Coord; tile: Tile }
  | { type: "merge"; at: Coord; into: Tile }
  | { type: "game_won"; at: Coord; tile: NumberTile }
  | { type: "game_over" };

export type GameState = {
  id: string;
  config: GameConfig;
  width: number;
  height: number;
  seed: number;
  rngStep: number;
  score: number;
  turn: number;
  won: boolean;
  over: boolean;
  grid: Cell[][];
};

export type StepRecord = {
  turn: number;
  dir: Dir;
  moved: boolean;
  before: GameState;
  after: GameState;
  events: GameEvent[];
};

export type GameSession = {
  initialState: GameState;
  current: GameState;
  steps: StepRecord[];
};

export type GameExport = {
  version: number;
  meta: { createdAtISO: string; engine: string };
  config: GameConfig;
  initial: GameState;
  steps: StepRecord[];
  final: GameState;
};
