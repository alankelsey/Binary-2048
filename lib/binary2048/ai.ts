import { applyMove } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameState } from "@/lib/binary2048/types";

export type EncodedCell = {
  type: 0 | 1 | 2 | 3;
  value: number;
};

export type EncodedState = EncodedCell[][];

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
