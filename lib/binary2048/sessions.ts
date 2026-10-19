import { applyMove, buildExport, createGame, runScenario } from "@/lib/binary2048/engine";
import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";
import { createRecoverySignature, verifyRecoverySignature } from "@/lib/binary2048/recovery-signature";
import {
  getSessionStore,
  getSessionStoreMode,
  inheritSessionRevision,
  SessionConflictError,
  SessionStorageUnavailableError
} from "@/lib/binary2048/session-store";
import type {
  Cell,
  Dir,
  GameConfig,
  GameExport,
  GameSession,
  GameState,
  SessionRecoverySnapshot,
  SessionStepRecord,
  StepRecord
} from "@/lib/binary2048/types";
import {
  isCompactRecoveryPayload,
  type CompactRecoveryPayload
} from "@/lib/binary2048/compact-recovery";

const UNDO_MODES = {
  normal: { pWildcard: 0.1, undoLimit: 2 },
  ltfg: { pWildcard: 0.2, undoLimit: 1 },
  death: { pWildcard: 0.04, undoLimit: 0 }
} as const;

export const SESSION_SCHEMA_VERSION = 2 as const;

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
  | "session_hydration_wait"
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

const DEFAULT_SHARED_SESSION_HYDRATION_TIMEOUT_MS = 180;
const DEFAULT_SHARED_SESSION_HYDRATION_POLL_MS = 20;

function boundedDuration(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(Math.floor(parsed), maximum) : fallback;
}

function sharedSessionHydrationTimeoutMs() {
  return boundedDuration(
    process.env.BINARY2048_SHARED_SESSION_HYDRATION_TIMEOUT_MS,
    DEFAULT_SHARED_SESSION_HYDRATION_TIMEOUT_MS,
    1_000
  );
}

function sharedSessionHydrationPollMs() {
  return Math.max(1, boundedDuration(
    process.env.BINARY2048_SHARED_SESSION_HYDRATION_POLL_MS,
    DEFAULT_SHARED_SESSION_HYDRATION_POLL_MS,
    100
  ));
}

function waitForHydration(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => finish(true), ms);
    const onAbort = () => finish(false);
    const finish = (completed: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(completed);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function recordElapsed(recorder: SessionTimingRecorder | undefined, name: SessionTimingName, startedAt: number) {
  recorder?.(name, Math.max(0, nowMs() - startedAt));
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type StoredSession = Omit<GameSession, "sessionVersion" | "steps" | "undoStates"> & {
  sessionVersion?: number;
  steps: Array<SessionStepRecord | StepRecord>;
  undoStates?: GameState[];
};

function isDirection(value: unknown): value is Dir {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

function isCompactStep(value: unknown): value is SessionStepRecord {
  if (!value || typeof value !== "object") return false;
  const step = value as Partial<SessionStepRecord>;
  return Number.isInteger(step.turn) && isDirection(step.dir) && typeof step.moved === "boolean";
}

function assertSupportedStoredSession(stored: StoredSession) {
  const version = stored.sessionVersion;
  if (version !== undefined && version !== 1 && version !== SESSION_SCHEMA_VERSION) {
    throw new Error(`Unsupported session schema version: ${String(version)}`);
  }
  if (version === SESSION_SCHEMA_VERSION) {
    if (!Array.isArray(stored.steps) || !stored.steps.every(isCompactStep) || !Array.isArray(stored.undoStates)) {
      throw new Error("Invalid session schema v2 record");
    }
  }
}

function replaySessionSteps(initialState: GameState, directions: Dir[]) {
  let current = copy(initialState);
  const fullSteps: StepRecord[] = [];
  for (const dir of directions) {
    const before = copy(current);
    const move = applyMove(current, dir);
    const after = copy(move.state);
    fullSteps.push({ turn: after.turn, dir, moved: move.moved, before, after, events: copy(move.events) });
    current = move.state;
  }
  return { current, fullSteps };
}

export function materializeSessionSteps(session: Pick<GameSession, "initialState" | "steps">): StepRecord[] {
  return replaySessionSteps(session.initialState, session.steps.map((step) => step.dir)).fullSteps;
}

function normalizeStoredSession(raw: GameSession): GameSession {
  const stored = raw as unknown as StoredSession;
  assertSupportedStoredSession(stored);
  if (stored.sessionVersion === SESSION_SCHEMA_VERSION) return raw;

  const directions = Array.isArray(stored.steps)
    ? stored.steps.flatMap((step) => isDirection(step?.dir) ? [step.dir] : [])
    : [];
  const replayed = replaySessionSteps(stored.initialState, directions);
  const compactSteps = replayed.fullSteps.map<SessionStepRecord>((step) => ({
    turn: step.turn,
    dir: step.dir,
    moved: step.moved
  }));
  const undoCapacity = Math.max(0, stored.undoLimit - stored.undoUsed);
  const undoStates = undoCapacity > 0
    ? replayed.fullSteps.slice(-undoCapacity).map((step) => copy(step.before))
    : [];

  Object.assign(stored, {
    sessionVersion: SESSION_SCHEMA_VERSION,
    steps: compactSteps,
    undoStates
  });
  return stored as GameSession;
}

function rethrowSessionStorageError(error: unknown): never {
  if (error instanceof SessionConflictError || error instanceof SessionStorageUnavailableError) throw error;
  throw new SessionStorageUnavailableError();
}

async function readStoredSession(id: string) {
  try {
    const session = await getSessionStore().get(id);
    return session ? normalizeStoredSession(session) : null;
  } catch (error) {
    rethrowSessionStorageError(error);
  }
}

/**
 * A shared-store null can race a just-completed write from another runtime.
 * Only Mongo-backed reads wait briefly for that record; memory mode remains a
 * single lookup. Cancellation stops the retry loop and preserves the normal
 * missing-session result rather than converting it into a storage failure.
 */
export async function getSessionAfterHydration(
  id: string,
  options?: { signal?: AbortSignal; recorder?: SessionTimingRecorder }
) {
  const first = await readStoredSession(id);
  if (first || getSessionStoreMode() !== "mongo") return first;

  const startedAt = nowMs();
  const deadline = startedAt + sharedSessionHydrationTimeoutMs();
  try {
    while (!options?.signal?.aborted) {
      const remaining = deadline - nowMs();
      if (remaining <= 0) return null;
      const waited = await waitForHydration(Math.min(sharedSessionHydrationPollMs(), remaining), options?.signal);
      if (!waited) return null;
      const hydrated = await readStoredSession(id);
      if (hydrated) return hydrated;
    }
    return null;
  } finally {
    recordElapsed(options?.recorder, "session_hydration_wait", startedAt);
  }
}

async function writeStoredSession(id: string, session: GameSession) {
  try {
    await getSessionStore().set(id, session);
  } catch (error) {
    rethrowSessionStorageError(error);
  }
}

async function deleteStoredSession(id: string) {
  try {
    await getSessionStore().delete(id);
  } catch (error) {
    rethrowSessionStorageError(error);
  }
}

export async function createSession(config?: Partial<GameConfig>, initialGrid?: Cell[][], options?: CreateSessionOptions) {
  const created = createGame(config, initialGrid);
  const session: GameSession = {
    sessionVersion: SESSION_SCHEMA_VERSION,
    initialState: created.state,
    current: created.state,
    steps: [],
    undoStates: [],
    undoLimit: inferUndoLimit(created.state.config),
    undoUsed: 0,
    undoEvents: [],
    integrity: { sessionClass: options?.sessionClass ?? "unranked", source: "created" }
  };
  (await writeStoredSession(created.state.id, session));
  return session;
}

export async function getSession(id: string, options?: { signal?: AbortSignal; recorder?: SessionTimingRecorder }) {
  return (await getSessionAfterHydration(id, options)) ?? null;
}

type RecoveryPayload = GameExport | SessionRecoverySnapshot | CompactRecoveryPayload;

function assertSupportedRecoveryPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid recovery payload");
  const candidate = payload as Record<string, unknown>;
  if ("recoveryVersion" in candidate) {
    if (candidate.recoveryVersion !== 1) {
      throw new Error(`Unsupported recovery snapshot version: ${String(candidate.recoveryVersion)}`);
    }
    return;
  }
  if (typeof candidate.version === "string") {
    if (!isCompactRecoveryPayload(candidate)) {
      throw new Error(`Unsupported compact recovery version: ${candidate.version}`);
    }
    return;
  }
  if ("version" in candidate && candidate.version !== 1) {
    throw new Error(`Unsupported game export version: ${String(candidate.version)}`);
  }
}

function isRecoverySnapshot(
  payload: RecoveryPayload
): payload is SessionRecoverySnapshot {
  return "recoveryVersion" in payload;
}

function recoveryDirections(payload: RecoveryPayload) {
  if (isCompactRecoveryPayload(payload)) {
    return [...payload.checkpoint.moves, ...payload.acknowledgedTail];
  }
  if (isRecoverySnapshot(payload)) return payload.moves;
  return payload.steps.map((step) => step.dir);
}

function directionsMatch(session: GameSession, snapshot: SessionRecoverySnapshot) {
  if (session.steps.length !== snapshot.moves.length) return false;
  return session.steps.every((step, index) => step.dir === snapshot.moves[index]);
}

export async function resolveSessionWithRecovery(
  id: string,
  recoveryPayload?: RecoveryPayload,
  options?: { signal?: AbortSignal; recorder?: SessionTimingRecorder }
) {
  return (await resolveSessionWithRecoveryDetails(id, recoveryPayload, options?.recorder, options)).session;
}

export async function resolveSessionWithRecoveryDetails(
  id: string,
  recoveryPayload?: RecoveryPayload,
  recorder?: SessionTimingRecorder,
  options?: { signal?: AbortSignal }
): Promise<{ session: GameSession | null; path: SessionPath }> {
  const lookupStartedAt = nowMs();
  let existing: GameSession | null;
  try {
    existing = (await getSession(id, { recorder, signal: options?.signal }));
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
      return {
        session,
        path: isRecoverySnapshot(recoveryPayload) || isCompactRecoveryPayload(recoveryPayload)
          ? "recovery_snapshot"
          : "legacy_export"
      };
    } finally {
      recordElapsed(recorder, "recovery_import", importStartedAt);
    }
  }
  if (isCompactRecoveryPayload(recoveryPayload)) {
    const desiredDirections = recoveryDirections(recoveryPayload);
    const browserIsNewer = desiredDirections.length > existing.steps.length;
    const sameLengthButDifferentHistory =
      desiredDirections.length === existing.steps.length &&
      existing.steps.some((step, index) => step.dir !== desiredDirections[index]);
    if (!browserIsNewer && !sameLengthButDifferentHistory) return { session: existing, path: existingPath };
    const imported = await importCompactRecoveryPayload(recoveryPayload, recorder);
    return { session: imported, path: "recovery_snapshot" };
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

export async function moveSession(id: string, dir: Dir, expected?: GameSession | null, recorder?: SessionTimingRecorder) {
  const session = expected === undefined ? (await getSession(id, { recorder })) : expected;
  if (!session) return null;

  const before = copy(session.current);
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

  session.steps.push({ turn: step.turn, dir: step.dir, moved: step.moved });
  const undoCapacity = Math.max(0, session.undoLimit - session.undoUsed);
  if (undoCapacity > 0) {
    session.undoStates.push(before);
    if (session.undoStates.length > undoCapacity) {
      session.undoStates.splice(0, session.undoStates.length - undoCapacity);
    }
  }
  session.current = move.state;
  const persistenceStartedAt = nowMs();
  try {
    (await writeStoredSession(id, session));
  } finally {
    recordElapsed(recorder, "session_persist", persistenceStartedAt);
  }
  return { session, lastStep: step };
}

export async function undoSession(id: string, expected?: GameSession) {
  const session = expected ?? (await getSession(id));
  if (!session) return { session: null, error: "NOT_FOUND" as const };
  if (session.steps.length === 0) return { session, error: null };
  if (session.undoUsed >= session.undoLimit) return { session, error: "LIMIT_REACHED" as const };

  const step = session.steps.pop();
  if (!step) return { session, error: null };
  const undoState = session.undoStates.pop();
  if (!undoState) throw new Error("Session undo state is unavailable");
  session.current = undoState;
  session.undoUsed += 1;
  session.undoEvents.push({
    i: session.undoEvents.length,
    undoneTurn: step.turn,
    usedAfter: session.undoUsed
  });
  (await writeStoredSession(id, session));
  return { session, error: null };
}

export async function exportSession(id: string) {
  const session = (await getSession(id));
  if (!session) return null;
  const steps = materializeSessionSteps(session);
  return buildExport(
    session.current.config,
    session.initialState,
    steps,
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
  const session = currentSession ?? (await getSession(id, { recorder }));
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
  const session = (await getSession(id));
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
  if ("version" in exported && exported.version !== 1) {
    throw new Error(`Unsupported game export version: ${String(exported.version)}`);
  }
  if (!exported.config || !exported.initial?.grid || !Array.isArray(exported.steps)) {
    throw new Error("Export is missing required fields");
  }

  const created = createGame(exported.config, exported.initial.grid);
  const initialState = created.state;
  let current = initialState;
  const steps: SessionStepRecord[] = [];
  const undoStates: GameState[] = [];

  const replayStartedAt = nowMs();
  try {
    for (const step of exported.steps) {
      if (!step || (step.dir !== "up" && step.dir !== "down" && step.dir !== "left" && step.dir !== "right")) {
        throw new Error("Export contains invalid move direction");
      }
      const before = current;
      const move = applyMove(before, step.dir);
      const fullStep: StepRecord = {
        turn: move.state.turn,
        dir: step.dir,
        moved: move.moved,
        before,
        after: move.state,
        events: move.events
      };
      steps.push({ turn: fullStep.turn, dir: fullStep.dir, moved: fullStep.moved });
      undoStates.push(copy(before));
      current = move.state;
      if (current.over) break;
    }
  } finally {
    recordElapsed(recorder, "recovery_replay", replayStartedAt);
  }

  const session: GameSession = {
    sessionVersion: SESSION_SCHEMA_VERSION,
    initialState,
    current,
    steps,
    undoStates: undoStates.slice(-inferUndoLimit(exported.config)),
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
    (await writeStoredSession(current.id, session));
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
      const lookupStartedAt = nowMs();
      let existing: GameSession | null;
      try {
        existing = await getSession(snapshot.sessionId);
      } finally {
        recordElapsed(recorder, "session_lookup", lookupStartedAt);
      }
      inheritSessionRevision(recovered, existing);
      recovered.initialState.id = snapshot.sessionId;
      recovered.current.id = snapshot.sessionId;
      for (const state of recovered.undoStates) state.id = snapshot.sessionId;
      const deleteStartedAt = nowMs();
      try {
        (await deleteStoredSession(generatedId));
      } finally {
        recordElapsed(recorder, "session_persist", deleteStartedAt);
      }
    }
    recovered.integrity = { ...snapshot.integrity };
    recovered.undoLimit = snapshot.undo.limit;
    recovered.undoUsed = snapshot.undo.used;
    recovered.undoEvents = snapshot.undo.events.map((event) => ({ ...event }));
    const undoCapacity = Math.max(0, recovered.undoLimit - recovered.undoUsed);
    recovered.undoStates = undoCapacity > 0 ? recovered.undoStates.slice(-undoCapacity) : [];
    const persistenceStartedAt = nowMs();
    try {
      (await writeStoredSession(recovered.current.id, recovered));
    } finally {
      recordElapsed(recorder, "session_persist", persistenceStartedAt);
    }
  }
  return recovered;
}

export async function importRecoveryPayload(
  snapshot: RecoveryPayload,
  recorder?: SessionTimingRecorder
) {
  assertSupportedRecoveryPayload(snapshot);
  return isCompactRecoveryPayload(snapshot)
    ? (await importCompactRecoveryPayload(snapshot, recorder))
    : "recoveryVersion" in snapshot
    ? (await importRecoverySnapshot(snapshot, recorder))
    : (await importSession(snapshot, recorder));
}

export async function importCompactRecoveryPayload(
  payload: CompactRecoveryPayload,
  recorder?: SessionTimingRecorder
) {
  if (!isCompactRecoveryPayload(payload)) throw new Error("Unsupported compact recovery payload");
  const secret = process.env.BINARY2048_RECOVERY_SECRET ?? "";
  if (!secret || !verifyRecoverySignature(payload.checkpoint, secret)) {
    throw new Error("Compact recovery checkpoint is not trusted");
  }
  const session = await importRecoverySnapshot(payload.checkpoint, recorder);
  for (const dir of payload.acknowledgedTail) {
    const moved = await moveSession(session.current.id, dir, session, recorder);
    if (!moved) throw new Error("Compact recovery session disappeared");
  }
  return session;
}
