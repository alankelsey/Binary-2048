import { applyMove, buildExport, createGame, runScenario } from "@/lib/binary2048/engine";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { createRecoverySignature, verifyRecoverySignature } from "@/lib/binary2048/recovery-signature";
import { getSessionStore, getSessionStoreMode, inheritSessionRevision } from "@/lib/binary2048/session-store";
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

export type SessionPath =
  | "resident_memory"
  | "mongo_hydration"
  | "recovery_snapshot"
  | "legacy_export"
  | "missing";

export type SessionTimingName =
  | "session_lookup"
  | "recovery_verify"
  | "recovery_replay"
  | "recovery_import"
  | "engine_move"
  | "session_persist"
  | "snapshot_build"
  | "snapshot_sign";

export type SessionTimingRecorder = (name: SessionTimingName, durationMs: number) => void;

function nowMs() {
  return performance.now();
}

function recordElapsed(recorder: SessionTimingRecorder | undefined, name: SessionTimingName, startedAt: number) {
  recorder?.(name, Math.max(0, nowMs() - startedAt));
}

export async function createSession(config?: Partial<GameConfig>, initialGrid?: Cell[][], options?: CreateSessionOptions) {
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
  (await getSessionStore().set(created.state.id, session));
  return session;
}

export async function getSession(id: string) {
  return (await getSessionStore().get(id)) ?? null;
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

export async function resolveSessionWithRecovery(
  id: string,
  recoveryPayload?: GameExport | SessionRecoverySnapshot
) {
  return (await resolveSessionWithRecoveryDetails(id, recoveryPayload)).session;
}

export async function resolveSessionWithRecoveryDetails(
  id: string,
  recoveryPayload?: GameExport | SessionRecoverySnapshot,
  recorder?: SessionTimingRecorder
): Promise<{ session: GameSession | null; path: SessionPath }> {
  const lookupStartedAt = nowMs();
  let existing: GameSession | null;
  try {
    existing = (await getSession(id));
  } finally {
    recordElapsed(recorder, "session_lookup", lookupStartedAt);
  }
  const existingPath: SessionPath = getSessionStoreMode() === "mongo" ? "mongo_hydration" : "resident_memory";
  if (!recoveryPayload) return { session: existing, path: existing ? existingPath : "missing" };
  if (existing && getSessionStoreMode() === "mongo") return { session: existing, path: existingPath };
  if (!existing) {
    const importStartedAt = nowMs();
    try {
      const session = (await importRecoveryPayload(recoveryPayload, recorder));
      return { session, path: isRecoverySnapshot(recoveryPayload) ? "recovery_snapshot" : "legacy_export" };
    } finally {
      recordElapsed(recorder, "recovery_import", importStartedAt);
    }
  }
  if (!isRecoverySnapshot(recoveryPayload)) return { session: existing, path: existingPath };

  const secret = process.env.BINARY2048_RECOVERY_SECRET ?? "";
  const verificationStartedAt = nowMs();
  const isTrustedForSession =
    recoveryPayload.sessionId === id && verifyRecoverySignature(recoveryPayload, secret);
  recordElapsed(recorder, "recovery_verify", verificationStartedAt);
  if (!isTrustedForSession) return { session: existing, path: existingPath };

  const browserIsNewer = recoveryPayload.moves.length > existing.steps.length;
  const sameLengthButDifferentHistory =
    recoveryPayload.moves.length === existing.steps.length && !directionsMatch(existing, recoveryPayload);
  if (!browserIsNewer && !sameLengthButDifferentHistory) {
    return { session: existing, path: existingPath };
  }
  const importStartedAt = nowMs();
  try {
    const session = (await importRecoverySnapshot(recoveryPayload, recorder));
    return { session, path: "recovery_snapshot" };
  } finally {
    recordElapsed(recorder, "recovery_import", importStartedAt);
  }
}

export async function moveSession(id: string, dir: Dir, expected?: GameSession, recorder?: SessionTimingRecorder) {
  const session = expected ?? (await getSessionStore().get(id));
  if (!session) return null;

  const before = session.current;
  const engineStartedAt = nowMs();
  const move = applyMove(before, dir);
  recordElapsed(recorder, "engine_move", engineStartedAt);
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
  const persistenceStartedAt = nowMs();
  try {
    (await getSessionStore().set(id, session));
  } finally {
    recordElapsed(recorder, "session_persist", persistenceStartedAt);
  }
  return session;
}

export async function undoSession(id: string, expected?: GameSession) {
  const session = expected ?? (await getSessionStore().get(id));
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
  (await getSessionStore().set(id, session));
  return { session, error: null };
}

export async function exportSession(id: string) {
  const session = (await getSessionStore().get(id));
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

export async function exportRecoverySnapshot(
  id: string,
  currentSession?: GameSession,
  recorder?: SessionTimingRecorder
): Promise<SessionRecoverySnapshot | null> {
  const session = currentSession ?? (await getSessionStore().get(id));
  if (!session) return null;
  const buildStartedAt = nowMs();
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
  recordElapsed(recorder, "snapshot_build", buildStartedAt);
  const secret = process.env.BINARY2048_RECOVERY_SECRET ?? "";
  if (!secret) return snapshot;
  const signingStartedAt = nowMs();
  try {
    return { ...snapshot, signature: createRecoverySignature(snapshot, secret) };
  } finally {
    recordElapsed(recorder, "snapshot_sign", signingStartedAt);
  }
}

export async function listSessionState(id: string) {
  const session = (await getSessionStore().get(id));
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

export async function importSession(exported: GameExport, recorder?: SessionTimingRecorder) {
  if (!exported || typeof exported !== "object") throw new Error("Invalid export payload");
  if (!exported.config || !exported.initial?.grid || !Array.isArray(exported.steps)) {
    throw new Error("Export is missing required fields");
  }

  const created = createGame(exported.config, exported.initial.grid);
  const initialState = created.state;
  let current = initialState;
  const steps: GameSession["steps"] = [];

  const replayStartedAt = nowMs();
  try {
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
  } finally {
    recordElapsed(recorder, "recovery_replay", replayStartedAt);
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
  const persistenceStartedAt = nowMs();
  try {
    (await getSessionStore().set(current.id, session));
  } finally {
    recordElapsed(recorder, "session_persist", persistenceStartedAt);
  }
  return session;
}

export async function importRecoverySnapshot(snapshot: SessionRecoverySnapshot, recorder?: SessionTimingRecorder) {
  if (snapshot?.recoveryVersion !== 1 || snapshot.rulesetId !== "binary2048-v1") {
    throw new Error("Unsupported recovery snapshot");
  }
  if (!snapshot.config || !Array.isArray(snapshot.initialGrid) || !Array.isArray(snapshot.moves)) {
    throw new Error("Recovery snapshot is missing required fields");
  }
  const replayStartedAt = nowMs();
  let exported: GameExport;
  try {
    exported = runScenario(snapshot.config, snapshot.initialGrid, snapshot.moves);
  } finally {
    recordElapsed(recorder, "recovery_replay", replayStartedAt);
  }
  const recovered = (await importSession(exported, recorder));
  const verificationStartedAt = nowMs();
  const trusted = verifyRecoverySignature(snapshot, process.env.BINARY2048_RECOVERY_SECRET ?? "");
  recordElapsed(recorder, "recovery_verify", verificationStartedAt);
  if (trusted && snapshot.integrity && snapshot.undo) {
    if (snapshot.sessionId) {
      const generatedId = recovered.current.id;
      const existing = await getSession(snapshot.sessionId);
      inheritSessionRevision(recovered, existing);
      recovered.initialState.id = snapshot.sessionId;
      recovered.current.id = snapshot.sessionId;
      for (const step of recovered.steps) {
        step.before.id = snapshot.sessionId;
        step.after.id = snapshot.sessionId;
      }
      const deleteStartedAt = nowMs();
      (await getSessionStore().delete(generatedId));
      recordElapsed(recorder, "session_persist", deleteStartedAt);
    }
    recovered.integrity = { ...snapshot.integrity };
    recovered.undoLimit = snapshot.undo.limit;
    recovered.undoUsed = snapshot.undo.used;
    recovered.undoEvents = snapshot.undo.events.map((event) => ({ ...event }));
    const persistenceStartedAt = nowMs();
    (await getSessionStore().set(recovered.current.id, recovered));
    recordElapsed(recorder, "session_persist", persistenceStartedAt);
  }
  return recovered;
}

export async function importRecoveryPayload(
  snapshot: GameExport | SessionRecoverySnapshot,
  recorder?: SessionTimingRecorder
) {
  return "recoveryVersion" in snapshot
    ? (await importRecoverySnapshot(snapshot, recorder))
    : (await importSession(snapshot, recorder));
}
