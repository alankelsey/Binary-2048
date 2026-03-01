import { applyMove, buildExport, createGame } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameSession } from "@/lib/binary2048/types";

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
    turn: before.turn + 1,
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
