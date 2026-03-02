import { applyMove } from "@/lib/binary2048/engine";
import { toActionCode, type ActionCode } from "@/lib/binary2048/action";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";

export type EncodedCell = {
  type: 0 | 1 | 2 | 3;
  value: number;
};

export type EncodedState = EncodedCell[][];

export const ACTION_SPACE: ActionCode[] = ["L", "R", "U", "D"];

export function encodeCell(cell: Cell): EncodedCell {
  if (!cell) return { type: 0, value: 0 };
  if (cell.t === "z") return { type: 1, value: 0 };
  if (cell.t === "n") return { type: 2, value: Math.max(0, Math.log2(Math.max(1, cell.v))) };
  return { type: 3, value: Math.max(0, Math.log2(Math.max(1, cell.m))) };
}

export function encodeState(state: Pick<GameState, "grid">): EncodedState {
  return state.grid.map((row) => row.map((cell) => encodeCell(cell)));
}

export function legalMoves(state: GameState): Dir[] {
  const dirs: Dir[] = ["up", "down", "left", "right"];
  return dirs.filter((dir) => {
    const moved = applyMove(state, dir);
    return moved.moved;
  });
}

export function legalActionCodes(state: GameState): ActionCode[] {
  return legalMoves(state).map((dir) => toActionCode(dir));
}

export function actionMask(legalActions: ActionCode[]): number[] {
  const set = new Set<ActionCode>(legalActions);
  return ACTION_SPACE.map((action) => (set.has(action) ? 1 : 0));
}

export function flattenEncodedState(encoded: EncodedState): number[] {
  const out: number[] = [];
  for (const row of encoded) {
    for (const cell of row) {
      out.push(cell.type, cell.value);
    }
  }
  return out;
}

export function stateHash(state: Pick<GameState, "grid" | "turn" | "score" | "rngStep">): string {
  const encoded = encodeState(state);
  const flattened = flattenEncodedState(encoded);
  const signature = JSON.stringify({
    t: state.turn,
    s: state.score,
    r: state.rngStep,
    f: flattened
  });

  // FNV-1a 32-bit hash for fast deterministic state identity checks.
  let hash = 0x811c9dc5;
  for (let i = 0; i < signature.length; i++) {
    hash ^= signature.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
