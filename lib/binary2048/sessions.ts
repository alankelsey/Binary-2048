import { applyMove, buildExport, createGame } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameExport, GameSession } from "@/lib/binary2048/types";

const globalStore = globalThis as typeof globalThis & {
  __binary2048_games?: Map<string, GameSession>;
};

const games = globalStore.__binary2048_games ?? new Map<string, GameSession>();
globalStore.__binary2048_games = games;

const UNDO_MODES = {
  normal: { pWildcard: 0.1, undoLimit: 2 },
  ltfg: { pWildcard: 0.2, undoLimit: 1 },
  death: { pWildcard: 0.04, undoLimit: 0 }
} as const;

function inferUndoLimit(config: Partial<GameConfig> | GameConfig | undefined): number {
  const wildcard = config?.spawn?.pWildcard;
  if (typeof wildcard !== "number") return UNDO_MODES.normal.undoLimit;
  const modes = Object.values(UNDO_MODES);
  const best = modes.reduce((prev, cur) => {
    const prevDelta = Math.abs(prev.pWildcard - wildcard);
    const curDelta = Math.abs(cur.pWildcard - wildcard);
    return curDelta < prevDelta ? cur : prev;
  });
  return best.undoLimit;
}

export function getUndoMeta(session: Pick<GameSession, "undoLimit" | "undoUsed">) {
  return {
    limit: session.undoLimit,
    used: session.undoUsed,
    remaining: Math.max(0, session.undoLimit - session.undoUsed)
  };
}

export function createSession(config?: Partial<GameConfig>, initialGrid?: Cell[][]) {
  const created = createGame(config, initialGrid);
  games.set(created.state.id, {
    initialState: created.state,
    current: created.state,
    steps: [],
    undoLimit: inferUndoLimit(created.state.config),
    undoUsed: 0
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

export function undoSession(id: string) {
  const session = games.get(id);
  if (!session) return { session: null, error: "NOT_FOUND" as const };
  if (session.steps.length === 0) return { session, error: null };
  if (session.undoUsed >= session.undoLimit) return { session, error: "LIMIT_REACHED" as const };

  const step = session.steps.pop();
  if (!step) return { session, error: null };
  session.current = step.before;
  session.undoUsed += 1;
  games.set(id, session);
  return { session, error: null };
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
    stepCount: session.steps.length,
    undo: getUndoMeta(session)
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
    steps,
    undoLimit: inferUndoLimit(exported.config),
    undoUsed: 0
  };
  games.set(current.id, session);
  return session;
}
