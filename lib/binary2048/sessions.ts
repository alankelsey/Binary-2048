import { applyMove, buildExport, createGame } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameExport, GameSession } from "@/lib/binary2048/types";

const globalStore = globalThis as typeof globalThis & {
  __binary2048_games?: Map<string, GameSession>;
};

const games = globalStore.__binary2048_games ?? new Map<string, GameSession>();
globalStore.__binary2048_games = games;

export function createSession(config?: Partial<GameConfig>, initialGrid?: Cell[][]) {
  const created = createGame(config, initialGrid);
  games.set(created.state.id, {
    initialState: created.state,
    current: created.state,
    steps: []
  });
  return games.get(created.state.id)!;
}

export function getSession(id: string) {
  return games.get(id) ?? null;
}

export function moveSession(id: string, dir: Dir) {
  const session = games.get(id);
  if (!session) return null;

  const before = session.current;
  const move = applyMove(before, dir);
  const step = {
    turn: move.state.turn,
    dir,
    moved: move.moved,
    before,
    after: move.state,
    events: move.events
  };

  session.steps.push(step);
  session.current = move.state;
  games.set(id, session);
  return session;
}

export function exportSession(id: string) {
  const session = games.get(id);
  if (!session) return null;
  return buildExport(session.current.config, session.initialState, session.steps, session.current);
}

export function listSessionState(id: string) {
  const session = games.get(id);
  if (!session) return null;
  return {
    id,
    current: session.current,
    stepCount: session.steps.length
  };
}

export function importSession(exported: GameExport) {
  if (!exported || typeof exported !== "object") throw new Error("Invalid export payload");
  if (!exported.config || !exported.initial?.grid || !Array.isArray(exported.steps)) {
    throw new Error("Export is missing required fields");
  }

  const created = createGame(exported.config, exported.initial.grid);
  const initialState = created.state;
  let current = initialState;
  const steps: GameSession["steps"] = [];

  for (const step of exported.steps) {
    if (!step || (step.dir !== "up" && step.dir !== "down" && step.dir !== "left" && step.dir !== "right")) {
      throw new Error("Export contains invalid move direction");
    }
    const before = current;
    const move = applyMove(before, step.dir);
    steps.push({
      turn: move.state.turn,
      dir: step.dir,
      moved: move.moved,
      before,
      after: move.state,
      events: move.events
    });
    current = move.state;
    if (current.over) break;
  }

  const session = {
    initialState,
    current,
    steps
  };
  games.set(current.id, session);
  return session;
}
