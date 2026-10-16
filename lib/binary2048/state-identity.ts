import type { Cell, GameState } from "./types";

export const STATE_HASH_VERSION = "fnv1a32-game-state-v2" as const;

type HashState = Pick<
  GameState,
  | "config"
  | "width"
  | "height"
  | "seed"
  | "rngStep"
  | "score"
  | "turn"
  | "won"
  | "over"
  | "grid"
>;

export function canonicalGameState(state: HashState): string {
  return JSON.stringify({
    config: {
      width: state.config.width,
      height: state.config.height,
      seed: state.config.seed,
      winTile: state.config.winTile,
      zeroBehavior: state.config.zeroBehavior,
      spawnOnNoopMove: state.config.spawnOnNoopMove,
      spawn: {
        pZero: state.config.spawn.pZero,
        pOne: state.config.spawn.pOne,
        pWildcard: state.config.spawn.pWildcard,
        pLock: state.config.spawn.pLock,
        wildcardMultipliers: state.config.spawn.wildcardMultipliers
      }
    },
    width: state.width,
    height: state.height,
    seed: state.seed,
    rngStep: state.rngStep,
    score: state.score,
    turn: state.turn,
    won: state.won,
    over: state.over,
    grid: state.grid.map((row) => row.map(canonicalCell))
  });
}

export function gameStateHash(state: HashState): string {
  return fnv1a32(canonicalGameState(state));
}

/** Legacy compatibility for callers that sent expectStateHash without a version. */
export function legacyGameStateHashV1(
  state: Pick<GameState, "grid" | "turn" | "score" | "rngStep">
): string {
  const flattened = state.grid.flatMap((row) => row.flatMap(legacyEncodedCell));
  return fnv1a32(JSON.stringify({ t: state.turn, s: state.score, r: state.rngStep, f: flattened }));
}

function canonicalCell(cell: Cell) {
  if (!cell) return null;
  if (cell.t === "n") return ["n", cell.v] as const;
  if (cell.t === "w") return ["w", cell.m] as const;
  return [cell.t] as const;
}

function legacyEncodedCell(cell: Cell): [number, number] {
  if (!cell) return [0, 0];
  if (cell.t === "z") return [1, 0];
  if (cell.t === "n") return [2, Math.max(0, Math.log2(Math.max(1, cell.v)))];
  if (cell.t === "w") return [3, Math.max(0, Math.log2(Math.max(1, cell.m)))];
  return [4, 0];
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
