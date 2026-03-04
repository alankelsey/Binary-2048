import { createHash } from "crypto";
import type { Cell, GameExport, GameState, StepRecord, Tile } from "@/lib/binary2048/types";

type ReplayAudit = NonNullable<GameExport["meta"]["audit"]>;

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function encodeTile(tile: Tile): string {
  if (tile.t === "n") return `n:${tile.v}`;
  if (tile.t === "w") return `w:${tile.m}`;
  return tile.t;
}

function encodeCell(cell: Cell): string {
  if (!cell) return "_";
  return encodeTile(cell);
}

function encodeGrid(grid: Cell[][]): string {
  return grid.map((row) => row.map(encodeCell).join(",")).join("|");
}

function encodeState(state: GameState): string {
  return [
    state.width,
    state.height,
    state.seed,
    state.rngStep,
    state.score,
    state.turn,
    state.won ? 1 : 0,
    state.over ? 1 : 0,
    encodeGrid(state.grid)
  ].join(";");
}

function encodeEvents(step: StepRecord): string {
  return step.events
    .map((event) => {
      if (event.type === "spawn") return `spawn:${event.at[0]}:${event.at[1]}:${encodeTile(event.tile)}`;
      if (event.type === "merge") return `merge:${event.at[0]}:${event.at[1]}:${encodeTile(event.into)}`;
      if (event.type === "lock_block") return `lock_block:${event.at[0]}:${event.at[1]}:${event.turn}`;
      if (event.type === "lock_break") return `lock_break:${event.at[0]}:${event.at[1]}:${event.turn}`;
      if (event.type === "game_won") return `game_won:${event.at[0]}:${event.at[1]}:${event.tile.v}`;
      return "game_over";
    })
    .join("|");
}

function encodeStep(step: StepRecord): string {
  return [
    step.turn,
    step.dir,
    step.moved ? 1 : 0,
    step.before.rngStep,
    step.after.rngStep,
    step.after.score,
    encodeEvents(step),
    encodeState(step.after)
  ].join(";");
}

export function buildReplayAudit(exported: GameExport): ReplayAudit {
  const initialHash = hash(`initial:${encodeState(exported.initial)}`);
  let prev = initialHash;
  const stepHashes: string[] = [];
  for (let i = 0; i < exported.steps.length; i++) {
    const stepHash = hash(`${prev};step:${i};${encodeStep(exported.steps[i])}`);
    stepHashes.push(stepHash);
    prev = stepHash;
  }
  return {
    mode: "sha256-chain-v1",
    initialHash,
    stepHashes,
    finalHash: prev,
    stepsHashed: stepHashes.length
  };
}
