import { applyMove, buildExport, createGame, runScenario } from "@/lib/binary2048/engine";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { createRecoverySignature, verifyRecoverySignature } from "@/lib/binary2048/recovery-signature";
import { getSessionStore } from "@/lib/binary2048/session-store";
import type { Cell, Dir, GameConfig, GameExport, GameSession, SessionRecoverySnapshot } from "@/lib/binary2048/types";

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

type CreateSessionOptions = {
  sessionClass?: "ranked" | "unranked";
};

export function createSession(config?: Partial<GameConfig>, initialGrid?: Cell[][], options?: CreateSessionOptions) {
  const created = createGame(config, initialGrid);
  const session: GameSession = {
    initialState: created.state,
    current: created.state,
    steps: [],
    undoLimit: inferUndoLimit(created.state.config),
    undoUsed: 0,
    undoEvents: [],
    integrity: { sessionClass: options?.sessionClass ?? "unranked", source: "created" }
  };
  getSessionStore().set(created.state.id, session);
  return session;
}

export function getSession(id: string) {
  return getSessionStore().get(id) ?? null;
}

function isRecoverySnapshot(
  payload: GameExport | SessionRecoverySnapshot
): payload is SessionRecoverySnapshot {
  return "recoveryVersion" in payload;
}

function directionsMatch(session: GameSession, snapshot: SessionRecoverySnapshot) {
  if (session.steps.length !== snapshot.moves.length) return false;
  return session.steps.every((step, index) => step.dir === snapshot.moves[index]);
}

export function resolveSessionWithRecovery(
  id: string,
  recoveryPayload?: GameExport | SessionRecoverySnapshot
) {
  const existing = getSession(id);
  if (!recoveryPayload) return existing;
  if (!existing) return importRecoveryPayload(recoveryPayload);
  if (!isRecoverySnapshot(recoveryPayload)) return existing;

  const secret = process.env.BINARY2048_RECOVERY_SECRET ?? "";
  const isTrustedForSession =
    recoveryPayload.sessionId === id && verifyRecoverySignature(recoveryPayload, secret);
  if (!isTrustedForSession) return existing;

  const browserIsNewer = recoveryPayload.moves.length > existing.steps.length;
  const sameLengthButDifferentHistory =
    recoveryPayload.moves.length === existing.steps.length && !directionsMatch(existing, recoveryPayload);
  return browserIsNewer || sameLengthButDifferentHistory
    ? importRecoverySnapshot(recoveryPayload)
    : existing;
}

export function moveSession(id: string, dir: Dir) {
  const session = getSessionStore().get(id);
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
  getSessionStore().set(id, session);
  return session;
}

export function undoSession(id: string) {
  const session = getSessionStore().get(id);
  if (!session) return { session: null, error: "NOT_FOUND" as const };
  if (session.steps.length === 0) return { session, error: null };
  if (session.undoUsed >= session.undoLimit) return { session, error: "LIMIT_REACHED" as const };

  const step = session.steps.pop();
  if (!step) return { session, error: null };
  session.current = step.before;
  session.undoUsed += 1;
  session.undoEvents.push({
    i: session.undoEvents.length,
    undoneTurn: step.turn,
    usedAfter: session.undoUsed
  });
  getSessionStore().set(id, session);
  return { session, error: null };
}

export function exportSession(id: string) {
  const session = getSessionStore().get(id);
  if (!session) return null;
  return buildExport(
    session.current.config,
    session.initialState,
    session.steps,
    session.current,
    session.integrity,
    {
      limit: session.undoLimit,
      used: session.undoUsed,
      remaining: Math.max(0, session.undoLimit - session.undoUsed),
      events: session.undoEvents
    }
  );
}

export function exportRecoverySnapshot(id: string): SessionRecoverySnapshot | null {
  const session = getSessionStore().get(id);
  if (!session) return null;
  const snapshot: SessionRecoverySnapshot = {
    recoveryVersion: 1,
    rulesetId: "binary2048-v1",
    sessionId: id,
    config: session.initialState.config,
    initialGrid: session.initialState.grid,
    moves: session.steps.map((step) => step.dir),
    integrity: { ...session.integrity },
    undo: {
      limit: session.undoLimit,
      used: session.undoUsed,
      events: session.undoEvents.map((event) => ({ ...event }))
    }
  };
  const secret = process.env.BINARY2048_RECOVERY_SECRET ?? "";
  return secret ? { ...snapshot, signature: createRecoverySignature(snapshot, secret) } : snapshot;
}

export function listSessionState(id: string) {
  const session = getSessionStore().get(id);
  if (!session) return null;
  return {
    id,
    current: session.current,
    stepCount: session.steps.length,
    undo: getUndoMeta(session),
    integrity: session.integrity,
    economy: {
      canContinueAfterWin: canContinueAfterWin(session.integrity.sessionClass)
    }
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

  const session: GameSession = {
    initialState,
    current,
    steps,
    undoLimit: inferUndoLimit(exported.config),
    undoUsed: 0,
    undoEvents: [],
    integrity: {
      sessionClass: "unranked",
      source: "imported",
      importedFromRulesetId: exported.meta?.rulesetId
    }
  };
  getSessionStore().set(current.id, session);
  return session;
}

export function importRecoverySnapshot(snapshot: SessionRecoverySnapshot) {
  if (snapshot?.recoveryVersion !== 1 || snapshot.rulesetId !== "binary2048-v1") {
    throw new Error("Unsupported recovery snapshot");
  }
  if (!snapshot.config || !Array.isArray(snapshot.initialGrid) || !Array.isArray(snapshot.moves)) {
    throw new Error("Recovery snapshot is missing required fields");
  }
  const exported = runScenario(snapshot.config, snapshot.initialGrid, snapshot.moves);
  const recovered = importSession(exported);
  const trusted = verifyRecoverySignature(snapshot, process.env.BINARY2048_RECOVERY_SECRET ?? "");
  if (trusted && snapshot.integrity && snapshot.undo) {
    if (snapshot.sessionId) {
      const generatedId = recovered.current.id;
      recovered.initialState.id = snapshot.sessionId;
      recovered.current.id = snapshot.sessionId;
      for (const step of recovered.steps) {
        step.before.id = snapshot.sessionId;
        step.after.id = snapshot.sessionId;
      }
      getSessionStore().delete(generatedId);
    }
    recovered.integrity = { ...snapshot.integrity };
    recovered.undoLimit = snapshot.undo.limit;
    recovered.undoUsed = snapshot.undo.used;
    recovered.undoEvents = snapshot.undo.events.map((event) => ({ ...event }));
    getSessionStore().set(recovered.current.id, recovered);
  }
  return recovered;
}

export function importRecoveryPayload(snapshot: GameExport | SessionRecoverySnapshot) {
  return "recoveryVersion" in snapshot ? importRecoverySnapshot(snapshot) : importSession(snapshot);
}
