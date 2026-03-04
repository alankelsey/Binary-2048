export type NumberTile = { t: "n"; v: number };
export type ZeroTile = { t: "z" };
export type WildcardTile = { t: "w"; m: number };
export type LockZeroTile = { t: "i" };
export type Tile = NumberTile | ZeroTile | WildcardTile | LockZeroTile;
export type Cell = Tile | null;
export type Dir = "up" | "down" | "left" | "right";
export type Coord = [number, number];

export type SpawnConfig = {
  pZero: number;
  pOne: number;
  pWildcard: number;
  pLock: number;
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
  | { type: "lock_block"; at: Coord; turn: number }
  | { type: "lock_break"; at: Coord; turn: number }
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
  undoLimit: number;
  undoUsed: number;
  integrity: SessionIntegrity;
};

export type SessionIntegrity = {
  sessionClass: "unranked" | "ranked";
  source: "created" | "imported";
  importedFromRulesetId?: string;
};

export type GameExport = {
  version: number;
  meta: {
    createdAtISO: string;
    engine: string;
    rulesetId: string;
    engineVersion: string;
    replay: {
      seed: number;
      moves: Dir[];
      movesApplied: number;
    };
    spawnProbs: {
      zero: number;
      one: number;
      wildcard: number;
      lock: number;
      wildcardMultipliers: number[];
    };
    integrity: SessionIntegrity;
    audit?: {
      mode: "sha256-chain-v1";
      initialHash: string;
      stepHashes: string[];
      finalHash: string;
      stepsHashed: number;
    };
  };
  config: GameConfig;
  initial: GameState;
  steps: StepRecord[];
  final: GameState;
};
