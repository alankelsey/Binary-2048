"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import { computeCellEffects, type CellEffect, type MoveEvent } from "@/lib/binary2048/cell-effects";
import { keyToDir, swipeToDir } from "@/lib/binary2048/input";
import { getUiPolicy } from "@/lib/binary2048/ui-policy";
import { parseReplayExport, replayStateAtStep, type ReplayData } from "@/lib/binary2048/replay";
import { buildShareLandingUrl, buildShareText, buildShareUrls } from "@/lib/binary2048/share";
import { buildIssueReportUrl } from "@/lib/binary2048/issue-report";
import { isThemeMode, THEMES, type ThemeMode } from "@/lib/binary2048/theme";
import { getControlVisibility } from "@/lib/binary2048/control-visibility";
import { getReplayCodeFromSearch } from "@/lib/binary2048/replay-link";
import { buildReplayUrl, getReplayShareErrorMessage } from "@/lib/binary2048/replay-share";
import { replaySpeedToDelayMs } from "@/lib/binary2048/replay-autoplay";
import { shouldStartNewGameOnReplayExit } from "@/lib/binary2048/replay-exit";
import { parseReplayStepInput } from "@/lib/binary2048/replay-scrubber";
import { getToolbarActionState } from "@/lib/binary2048/toolbar-actions";
import { getNewGameGuardState } from "@/lib/binary2048/new-game-guard";
import { getNewGameStartAction } from "@/lib/binary2048/startup-new-game";
import { requestResumableMove } from "@/lib/binary2048/resumable-move";
import { createClientAuthBridge } from "@/lib/binary2048/client-auth-bridge";
import {
  copyTextWithFallback,
  downloadJson,
  filenameFromDisposition
} from "@/lib/binary2048/browser-actions";
import {
  diagnosticValue,
  formatDiagnosticEntries,
  type DiagnosticEntry,
  type DiagnosticLevel
} from "@/lib/binary2048/diagnostics";
import {
  exitDocumentFullscreen,
  isFullscreenActive,
  isFullscreenSupported,
  requestElementFullscreen
} from "@/lib/binary2048/fullscreen";
import { isFullscreenToggleEnabled } from "@/lib/binary2048/fullscreen-visibility";
import { shouldShowImportJson } from "@/lib/binary2048/import-visibility";
import { getGameImportErrorMessage, toGameImportPayload } from "@/lib/binary2048/game-import";
import {
  TUTORIAL_LESSONS,
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_SUCCESS_DURATION_MS,
  applyTutorialMove,
  armTutorial,
  clearTutorialSuppressCookie,
  continueTutorial,
  createTutorialSession,
  hasTutorialSuppressCookie,
  parseTutorialPreference,
  tutorialExpectedDirection,
  tutorialPreference,
  tutorialSuppressCookie,
  type TutorialSession
} from "@/lib/binary2048/tutorial";
import { clearResumeSnapshot, loadResumeSnapshot, saveResumeSnapshot } from "@/lib/binary2048/resume-recovery";
import {
  createInitialRageTapState,
  normalizeAuditControlLabel,
  recordRageTap
} from "@/lib/binary2048/ux-audit";
import { GameOverOverlay, NewGameOverlay, WinOverlay } from "@/app/game-overlays";
import { applyUiPolicyOverrides, type UIControlOverrides } from "@/lib/binary2048/ui-policy-override";
import type { UIControl } from "@/lib/binary2048/ui-policy";
import { createReferralCode, type MarketingEventType } from "@/lib/binary2048/marketing";
import type { GameExport, SessionRecoverySnapshot } from "@/lib/binary2048/types";
import {
  discardMovePerformanceTrace,
  dropMovePerformanceTrace,
  finishMovePerformanceTrace,
  markMovePerformancePhase,
  recordMoveQueueDepth,
  startMovePerformanceTrace,
  type MoveInputDropReason,
  type MoveInputSource,
  type MovePerformanceTrace
} from "@/lib/binary2048/move-performance";

type Tile = { t: "n"; v: number } | { t: "z" } | { t: "w"; m: number } | { t: "i" };
type Cell = Tile | null;
type Dir = "up" | "down" | "left" | "right";
type SpawnMode = "normal" | "ltfg" | "death";
type ColorMode = "default" | "cb-protanopia" | "cb-deuteranopia" | "cb-tritanopia";
type GameMode = "classic" | "bitstorm";

type GameState = {
  id: string;
  width: number;
  height: number;
  config?: {
    spawn?: {
      pWildcard?: number;
      pLock?: number;
    };
  };
  score: number;
  turn: number;
  won: boolean;
  over: boolean;
  grid: Cell[][];
};
type UndoMeta = { limit: number; used: number; remaining: number };
type SessionClass = "ranked" | "unranked";

const SPAWN_MODES: Record<
  SpawnMode,
  {
    label: string;
    pWildcard: number;
    pLock: number;
  }
> = {
  normal: { label: "Normal", pWildcard: 0.1, pLock: 0.03 },
  ltfg: { label: "LTFG", pWildcard: 0.2, pLock: 0.02 },
  death: { label: "Death by AI", pWildcard: 0.04, pLock: 0.08 }
};
const GAME_MODES: Record<GameMode, { label: string }> = {
  classic: { label: "Classic" },
  bitstorm: { label: "Bitstorm" }
};
const DIFFICULTY_HELP_TEXT =
  "Difficulty changes wildcard/lock spawn rates: Normal = balanced, LTFG = more wildcards and fewer locks, Death by AI = fewer wildcards and more locks.";
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";
const GAME_LOG_ENABLED = process.env.NEXT_PUBLIC_GAME_LOG_ENABLED === "1";
const UI_POLICY = getUiPolicy();
const FULLSCREEN_TOGGLE_ENABLED = isFullscreenToggleEnabled();
const MAX_BUFFERED_MOVES = 8;

function Binary2048Logo() {
  return (
    <svg className="brand-logo" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4cc9ff" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#0b1628" stroke="#2a4f85" />
      <rect x="12" y="12" width="18" height="18" rx="5" fill="url(#g1)" />
      <rect x="34" y="12" width="18" height="18" rx="5" fill="#1f2d41" />
      <rect x="12" y="34" width="18" height="18" rx="5" fill="#1f2d41" />
      <rect x="34" y="34" width="18" height="18" rx="5" fill="url(#g1)" />
      <text x="21" y="24.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#eef7ff">
        1
      </text>
      <text x="43" y="46.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#eef7ff">
        0
      </text>
    </svg>
  );
}

export default function Home() {
  const gameIdKey = "binary2048.currentGameId";
  const modeKey = "binary2048.spawnMode";
  const gameModeKey = "binary2048.gameMode";
  const highScoreKey = "binary2048.highScore";
  const colorModeKey = "binary2048.colorMode";
  const themeModeKey = "binary2048.themeMode";
  const [gameId, setGameId] = useState<string>("");
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [startNewGamePending, setStartNewGamePending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [highScore, setHighScore] = useState(0);
  const [spawnMode, setSpawnMode] = useState<SpawnMode>("normal");
  const [colorMode, setColorMode] = useState<ColorMode>("default");
  const [themeMode, setThemeMode] = useState<ThemeMode>("classic");
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [cellEffects, setCellEffects] = useState<Record<string, CellEffect>>({});
  const [undo, setUndo] = useState<UndoMeta>({ limit: 2, used: 0, remaining: 2 });
  const [replay, setReplay] = useState<{ data: ReplayData; step: number; sourceName: string } | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(5);
  const [shareMessage, setShareMessage] = useState<string>("");
  const [preparedReplayUrl, setPreparedReplayUrl] = useState<string>("");
  const [diagnosticEntries, setDiagnosticEntries] = useState<DiagnosticEntry[]>([]);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [newGameConfirmArmed, setNewGameConfirmArmed] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [compactMobile, setCompactMobile] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [sessionClass, setSessionClass] = useState<SessionClass>("unranked");
  const [canContinueAfterWin, setCanContinueAfterWin] = useState(true);
  const [continueAfterWin, setContinueAfterWin] = useState(false);
  const [uiControlOverrides, setUiControlOverrides] = useState<UIControlOverrides>({});
  const [referralCode, setReferralCode] = useState("");
  const [difficultyHelpOpen, setDifficultyHelpOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [tutorial, setTutorial] = useState<TutorialSession | null>(null);
  const [tutorialReminder, setTutorialReminder] = useState(true);
  const [suppressTutorialReminder, setSuppressTutorialReminder] = useState(false);
  const [newGameSetupOpen, setNewGameSetupOpen] = useState(false);
  const [newGameTutorialChoiceOpen, setNewGameTutorialChoiceOpen] = useState(false);
  const [tutorialLaunchConfirmOpen, setTutorialLaunchConfirmOpen] = useState(false);
  const [tutorialExitConfirmOpen, setTutorialExitConfirmOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const effectTimerRef = useRef<number | null>(null);
  const tutorialAdvanceTimerRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const replayInputRef = useRef<HTMLInputElement | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const controlTapStateRef = useRef(createInitialRageTapState());
  const pendingNewGameRef = useRef(false);
  const moveInFlightRef = useRef(false);
  const bufferedMovesRef = useRef<Array<{ dir: Dir; trace: MovePerformanceTrace }>>([]);
  const pendingPaintTraceRef = useRef<{ trace: MovePerformanceTrace; turn: number } | null>(null);
  const paintFrameRef = useRef<number | null>(null);
  const paintFrameTraceRef = useRef<MovePerformanceTrace | null>(null);
  const keyboardInputHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  const diagnosticSequenceRef = useRef(0);
  const authBridgeRef = useRef<ReturnType<typeof createClientAuthBridge> | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  if (!authBridgeRef.current) {
    authBridgeRef.current = createClientAuthBridge(
      (input, init) => fetch(input, init),
      Date.now,
      () =>
        typeof document !== "undefined" &&
        document.querySelector<HTMLElement>(".auth-shell")?.dataset.authenticated === "true"
    );
  }

  const addDiagnostic = useCallback(
    (
      event: string,
      details?: Record<string, string | number | boolean | null>,
      level: DiagnosticLevel = "info"
    ) => {
      if (!GAME_LOG_ENABLED) return;
      diagnosticSequenceRef.current += 1;
      const entry: DiagnosticEntry = {
        sequence: diagnosticSequenceRef.current,
        atISO: new Date().toISOString(),
        level,
        event,
        details
      };
      setDiagnosticEntries((current) => [...current.slice(-249), entry]);
    },
    []
  );

  function clearBufferedMoves(reason: MoveInputDropReason) {
    while (bufferedMovesRef.current.length > 0) {
      const queueDepth = bufferedMovesRef.current.length;
      const buffered = bufferedMovesRef.current.shift();
      if (buffered) dropMovePerformanceTrace(buffered.trace, reason, queueDepth);
    }
  }

  function dropDirectionalInput(dir: Dir, source: MoveInputSource, reason: MoveInputDropReason) {
    const trace = startMovePerformanceTrace(dir, source);
    recordMoveQueueDepth(trace, "capture", bufferedMovesRef.current.length);
    dropMovePerformanceTrace(trace, reason, bufferedMovesRef.current.length);
  }

  useEffect(() => {
    setAuthenticated(
      document.querySelector<HTMLElement>(".auth-shell")?.dataset.authenticated === "true"
    );
    void authBridgeRef.current?.authorizationHeader();
  }, []);

  useEffect(() => {
    if (!GAME_LOG_ENABLED) return;
    addDiagnostic("diagnostics_ready", {
      commit: APP_COMMIT,
      userAgent: navigator.userAgent,
      authenticated:
        document.querySelector<HTMLElement>(".auth-shell")?.dataset.authenticated === "true"
    });

    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      originalConsoleError(...args);
      addDiagnostic(
        "console_error",
        { message: args.map((arg) => diagnosticValue(arg)).join(" ").slice(0, 1200) },
        "error"
      );
    };

    const onWindowError = (event: ErrorEvent) => {
      addDiagnostic(
        "window_error",
        {
          message: diagnosticValue(event.error ?? event.message).slice(0, 1200),
          file: event.filename || null,
          line: event.lineno || null,
          column: event.colno || null
        },
        "error"
      );
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      addDiagnostic(
        "unhandled_rejection",
        { message: diagnosticValue(event.reason).slice(0, 1200) },
        "error"
      );
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      console.error = originalConsoleError;
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [addDiagnostic]);

  function resolveCanContinueAfterWin(payload: unknown): boolean {
    const response = payload as {
      economy?: { canContinueAfterWin?: boolean };
      integrity?: { sessionClass?: SessionClass };
    };
    if (typeof response?.economy?.canContinueAfterWin === "boolean") {
      return response.economy.canContinueAfterWin;
    }
    return response?.integrity?.sessionClass !== "ranked";
  }

  function applyLoadedSession(json: {
    id: string;
    current: GameState;
    recoverySnapshot?: SessionRecoverySnapshot;
    undo?: UndoMeta;
    integrity?: { sessionClass?: SessionClass };
    economy?: { canContinueAfterWin?: boolean };
  }) {
    setGameId(json.id);
    setState(json.current);
    setContinueAfterWin(false);
    setSessionClass((json?.integrity?.sessionClass as SessionClass) ?? "unranked");
    setCanContinueAfterWin(resolveCanContinueAfterWin(json));
    if (json?.undo) setUndo(json.undo as UndoMeta);
    setCellEffects({});
    window.localStorage.setItem(gameIdKey, json.id);
    if (json.recoverySnapshot) {
      saveResumeSnapshot(window.localStorage, json.id, json.recoverySnapshot);
    }
    addDiagnostic("session_loaded", {
      gameId: json.id,
      turn: json.current.turn,
      score: json.current.score,
      recoveryMoves: json.recoverySnapshot?.moves.length ?? null,
      difficultyWildcardRate: json.current.config?.spawn?.pWildcard ?? null
    });

    const importedRate = json?.current?.config?.spawn?.pWildcard;
    if (typeof importedRate === "number") {
      const inferredMode = modeFromWildcardRate(importedRate);
      setSpawnMode(inferredMode);
      window.localStorage.setItem(modeKey, inferredMode);
    }
  }

  async function importSnapshotExport(snapshotExport: unknown): Promise<{
    id: string;
    current: GameState;
    undo?: UndoMeta;
  } | null> {
    try {
      const res = await fetch("/api/games/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(snapshotExport)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current || !json?.id) return null;
      applyLoadedSession(json as { id: string; current: GameState; undo?: UndoMeta });
      return json as { id: string; current: GameState; undo?: UndoMeta };
    } catch {
      return null;
    }
  }

  async function recoverFromLocalSnapshot(
    expectedGameId?: string,
    options?: { notify?: boolean }
  ): Promise<{ id: string; current: GameState; undo?: UndoMeta } | null> {
    const snapshot = loadResumeSnapshot(window.localStorage, expectedGameId);
    if (!snapshot) return null;
    const recovered = await importSnapshotExport(snapshot);
    if (recovered) {
      void trackMarketing("session_resume_success", "resume", {
        source: "local_snapshot",
        expectedGameId: expectedGameId ?? "unknown"
      });
      if (options?.notify !== false) {
        setErrorMessage("Recovered your last local game snapshot.");
      }
      return recovered;
    }
    return null;
  }

  async function newGame(options?: { clearSnapshot?: boolean; allowWhileBusy?: boolean }) {
    const startAction = options?.allowWhileBusy
      ? "start"
      : getNewGameStartAction({ busy, initializing, gameId });
    if (startAction !== "start") {
      if (startAction === "queue") {
        pendingNewGameRef.current = true;
        setStartNewGamePending(true);
      }
      return;
    }
    setNewGameTutorialChoiceOpen(false);
    setNewGameSetupOpen(false);
    setReplay(null);
    setPreparedReplayUrl("");
    clearBufferedMoves("buffer_cleared_new_game");
    setContinueAfterWin(false);
    setNewGameConfirmArmed(false);
    setBusy(true);
    setErrorMessage("");
    if (options?.clearSnapshot !== false) {
      clearResumeSnapshot(window.localStorage);
    }
    try {
      const pZero = 0.15;
      const pWildcard = SPAWN_MODES[spawnMode].pWildcard;
      const pLock = SPAWN_MODES[spawnMode].pLock;
      const pOne = 1 - pZero - pWildcard - pLock;
      const authHeaders = await authBridgeRef.current?.authorizationHeader();
      addDiagnostic("new_game_request", {
        difficulty: spawnMode,
        gameMode,
        pWildcard,
        pLock
      });
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({
          mode: gameMode,
          config: {
            spawn: {
              pZero,
              pOne,
              pWildcard,
              pLock,
              wildcardMultipliers: [2]
            }
          }
        })
      });
      const json = await res.json().catch(() => ({}));
      addDiagnostic(
        "new_game_response",
        {
          status: res.status,
          gameId: typeof json?.id === "string" ? json.id : null,
          turn: typeof json?.current?.turn === "number" ? json.current.turn : null,
          recoveryMoves: Array.isArray(json?.recoverySnapshot?.moves)
            ? json.recoverySnapshot.moves.length
            : null
        },
        res.ok ? "info" : "error"
      );
      if (!res.ok || !json?.current || !json?.id) {
        const message = (json && typeof json.error === "string" ? json.error : "Failed to create game");
        throw new Error(message);
      }
      applyLoadedSession(json as { id: string; current: GameState; undo?: UndoMeta });
      window.localStorage.setItem(modeKey, spawnMode);
    } catch (error) {
      addDiagnostic("new_game_error", { message: diagnosticValue(error) }, "error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to create game");
    } finally {
      setBusy(false);
      setStartNewGamePending(false);
    }
  }

  async function restoreGame(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/games/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current || json?.id !== id) return false;
      applyLoadedSession(json as { id: string; current: GameState; undo?: UndoMeta });
      void trackMarketing("session_resume_success", "resume", {
        source: "server",
        gameId: id
      });
      setErrorMessage("");
      setNewGameConfirmArmed(false);
      return true;
    } catch {
      return false;
    }
  }

  async function move(dir: Dir, trace?: MovePerformanceTrace) {
    const inputTrace = trace ?? startMovePerformanceTrace(dir, "control");
    if (!inputTrace.queueDepthSamples.some((sample) => sample.stage === "capture")) {
      recordMoveQueueDepth(inputTrace, "capture", bufferedMovesRef.current.length);
    }
    if (tutorial) {
      if (tutorial.phase !== "active" || tutorialExitConfirmOpen || tutorialLaunchConfirmOpen) {
        dropMovePerformanceTrace(inputTrace, "tutorial_unavailable", bufferedMovesRef.current.length);
        return;
      }
      const result = applyTutorialMove(tutorial, dir);
      setTutorial(result.session);
      window.localStorage.setItem(
        TUTORIAL_STORAGE_KEY,
        JSON.stringify(
          tutorialPreference(
            "active",
            result.session.lessonIndex
          )
        )
      );
      discardMovePerformanceTrace(inputTrace);
      return;
    }
    if (replay) {
      dropMovePerformanceTrace(inputTrace, "replay_active", bufferedMovesRef.current.length);
      return;
    }
    if (!gameId || !state) {
      dropMovePerformanceTrace(inputTrace, "game_unavailable", bufferedMovesRef.current.length);
      return;
    }
    if (state.over) {
      dropMovePerformanceTrace(inputTrace, "game_over", bufferedMovesRef.current.length);
      return;
    }
    if (state.won && !continueAfterWin) {
      dropMovePerformanceTrace(inputTrace, "win_continuation_required", bufferedMovesRef.current.length);
      return;
    }
    if (moveInFlightRef.current) {
      if (bufferedMovesRef.current.length < MAX_BUFFERED_MOVES) {
        markMovePerformancePhase(inputTrace, "queued");
        bufferedMovesRef.current.push({ dir, trace: inputTrace });
        recordMoveQueueDepth(inputTrace, "enqueue", bufferedMovesRef.current.length);
        addDiagnostic("move_buffered", {
          dir,
          gameId,
          queued: bufferedMovesRef.current.length,
          turn: state.turn
        });
      }
      else dropMovePerformanceTrace(inputTrace, "queue_full", bufferedMovesRef.current.length);
      return;
    }
    if (busy) {
      dropMovePerformanceTrace(inputTrace, "busy", bufferedMovesRef.current.length);
      return;
    }
    const activeTrace = inputTrace;
    if (!activeTrace.phases.some((phase) => phase.phase === "queued")) {
      markMovePerformancePhase(activeTrace, "accepted");
    }
    markMovePerformancePhase(activeTrace, "local_engine_not_run");
    moveInFlightRef.current = true;
    const previous = state;
    setBusy(true);
    setErrorMessage("");
    try {
      const moveResult = await requestResumableMove({
        sessionId: gameId,
        async requestMove(sessionId, recoveredSession?: { id: string; recoverySnapshot: GameExport | SessionRecoverySnapshot }) {
          const attempt = recoveredSession ? 2 : 1;
          const authHeaders = await authBridgeRef.current?.authorizationHeader();
          const recoverySnapshot =
            recoveredSession?.recoverySnapshot ?? loadResumeSnapshot(window.localStorage, sessionId) ?? undefined;
          addDiagnostic("move_request", {
            dir,
            gameId: sessionId,
            turn: previous.turn,
            score: previous.score,
            recoveryMoves:
              recoverySnapshot && "recoveryVersion" in recoverySnapshot
                ? recoverySnapshot.moves.length
                : recoverySnapshot?.steps.length ?? null,
            recoveryRetry: Boolean(recoveredSession)
          });
          markMovePerformancePhase(activeTrace, "request_start", attempt);
          const response = await fetch(`/api/games/${sessionId}/move`, {
            method: "POST",
            headers: { "content-type": "application/json", ...authHeaders },
            body: JSON.stringify({ dir, recoverySnapshot })
          });
          markMovePerformancePhase(activeTrace, "response_headers", attempt);
          markMovePerformancePhase(activeTrace, "response_parse_start", attempt);
          const payload = await response.json().catch(() => ({}));
          markMovePerformancePhase(activeTrace, "response_parse_end", attempt);
          addDiagnostic(
            "move_response",
            {
              dir,
              status: response.status,
              requestGameId: sessionId,
              responseGameId: typeof payload?.id === "string" ? payload.id : null,
              turn: typeof payload?.current?.turn === "number" ? payload.current.turn : null,
              score: typeof payload?.current?.score === "number" ? payload.current.score : null,
              recoveryMoves: Array.isArray(payload?.recoverySnapshot?.moves)
                ? payload.recoverySnapshot.moves.length
                : null,
              error: typeof payload?.error === "string" ? payload.error : null
            },
            response.ok ? "info" : "error"
          );
          return {
            ok: response.ok,
            status: response.status,
            payload
          };
        },
        async recoverSession(staleSessionId) {
          const recoverySnapshot = loadResumeSnapshot(window.localStorage, staleSessionId);
          return recoverySnapshot ? { id: staleSessionId, recoverySnapshot } : null;
        }
      });
      const { attempt } = moveResult;
      const json = attempt.payload as { current?: GameState; error?: string; undo?: UndoMeta; lastStep?: { events?: MoveEvent[] }; integrity?: { sessionClass?: SessionClass } };
      if (!attempt.ok || !json?.current) {
        if (attempt.status === 404) {
          void trackMarketing("session_resume_miss", "resume", {
            gameId,
            outcome: "move_404_preserved_board"
          });
          throw new Error("Game session could not be recovered. Your board is still saved; reload to retry.");
        }
        throw new Error(typeof json.error === "string" ? json.error : "Failed to apply move");
      }
      setErrorMessage("");
      const next = json.current as GameState;
      const responseId = typeof (json as { id?: unknown }).id === "string" ? (json as { id: string }).id : gameId;
      if (responseId !== gameId) {
        setGameId(responseId);
        window.localStorage.setItem(gameIdKey, responseId);
      }
      const recoverySnapshot = (json as { recoverySnapshot?: SessionRecoverySnapshot }).recoverySnapshot;
      if (recoverySnapshot) {
        saveResumeSnapshot(window.localStorage, responseId, recoverySnapshot);
        addDiagnostic("recovery_snapshot_saved", {
          gameId: responseId,
          moves: recoverySnapshot.moves.length,
          turn: next.turn
        });
      }
      if (next.turn < previous.turn || next.score < previous.score) {
        addDiagnostic(
          "state_regression_detected",
          {
            gameId: responseId,
            previousTurn: previous.turn,
            nextTurn: next.turn,
            previousScore: previous.score,
            nextScore: next.score,
            recoveryMoves: recoverySnapshot?.moves.length ?? null
          },
          "error"
        );
      }
      setSessionClass((json?.integrity?.sessionClass as SessionClass) ?? sessionClass);
      setCanContinueAfterWin(resolveCanContinueAfterWin(json));
      if (json?.undo) setUndo(json.undo as UndoMeta);
      const events = Array.isArray(json?.lastStep?.events) ? (json.lastStep.events as MoveEvent[]) : [];
      pendingPaintTraceRef.current = { trace: activeTrace, turn: next.turn };
      setState(next);
      setNewGameConfirmArmed(false);
      startCellEffects(computeCellEffects(previous, next, events, dir));
      if (next.over) {
        window.localStorage.removeItem(gameIdKey);
      }
    } catch (error) {
      discardMovePerformanceTrace(activeTrace);
      clearBufferedMoves("buffer_cleared_move_error");
      addDiagnostic(
        "move_error",
        { dir, gameId, turn: previous.turn, message: diagnosticValue(error) },
        "error"
      );
      setErrorMessage(error instanceof Error ? error.message : "Failed to apply move");
    } finally {
      moveInFlightRef.current = false;
      setBusy(false);
    }
  }

  async function undoMove() {
    if (busy || replay || !gameId) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const requestUndo = async (recoverySnapshot?: GameExport | SessionRecoverySnapshot) => {
        const authHeaders = await authBridgeRef.current?.authorizationHeader();
        return fetch(`/api/games/${gameId}/undo`, {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders },
          body: JSON.stringify({ recoverySnapshot })
        });
      };
      let res = await requestUndo();
      if (res.status === 404) {
        const recoverySnapshot = loadResumeSnapshot(window.localStorage, gameId);
        if (recoverySnapshot) res = await requestUndo(recoverySnapshot);
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current) {
        const message = (json && typeof json.error === "string" ? json.error : "Failed to undo move");
        throw new Error(message);
      }
      const responseId = typeof json.id === "string" ? json.id : gameId;
      if (responseId !== gameId) {
        setGameId(responseId);
        window.localStorage.setItem(gameIdKey, responseId);
      }
      if (json.recoverySnapshot) {
        saveResumeSnapshot(window.localStorage, responseId, json.recoverySnapshot as SessionRecoverySnapshot);
      }
      setState(json.current as GameState);
      if (json?.undo) setUndo(json.undo as UndoMeta);
      setNewGameConfirmArmed(false);
      setCellEffects({});
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to undo move");
    } finally {
      setBusy(false);
    }
  }

  function startCellEffects(effects: Record<string, CellEffect>) {
    if (effectTimerRef.current) {
      window.clearTimeout(effectTimerRef.current);
      effectTimerRef.current = null;
    }
    setCellEffects(effects);
    if (Object.keys(effects).length === 0) return;
    effectTimerRef.current = window.setTimeout(() => {
      setCellEffects({});
      effectTimerRef.current = null;
    }, 460);
  }

  function label(cell: Cell): string {
    if (!cell) return "";
    if (cell.t === "z") return "0";
    if (cell.t === "w") return "";
    if (cell.t === "i") return "";
    return String(cell.v);
  }

  function cellTypeClass(cell: Cell): string {
    if (!cell) return "cell-empty";
    if (cell.t === "w") return "tile-wild";
    if (cell.t === "z") return "tile-zero";
    if (cell.t === "i") return "tile-lock";
    return "tile-number";
  }

  function numberTileStyle(cell: Cell): CSSProperties | undefined {
    if (!cell || cell.t !== "n") return undefined;
    const exp = Math.max(0, Math.log2(Math.max(1, cell.v)));
    const t = Math.min(1, exp / 11);
    const ramps: Record<ColorMode, { from: number; to: number; sat: number }> = {
      default: { from: 210, to: 4, sat: 72 },
      "cb-protanopia": { from: 198, to: 38, sat: 74 },
      "cb-deuteranopia": { from: 235, to: 314, sat: 70 },
      "cb-tritanopia": { from: 178, to: 24, sat: 76 }
    };
    const ramp = ramps[colorMode];
    const hue = Math.round(ramp.from + (ramp.to - ramp.from) * t);
    const lightTop = Math.round(30 + 22 * t);
    const lightBottom = Math.round(22 + 15 * t);
    return {
      color: "#f8fbff",
      background: `linear-gradient(180deg, hsl(${hue} ${ramp.sat}% ${lightTop}%), hsl(${hue} ${Math.min(
        84,
        ramp.sat + 2
      )}% ${lightBottom}%))`,
      borderColor: `hsl(${Math.max(0, hue - 8)} 80% ${Math.min(70, lightTop + 14)}%)`
    };
  }

  function modeFromWildcardRate(pWildcard: number): SpawnMode {
    const modes: SpawnMode[] = ["normal", "ltfg", "death"];
    return modes.reduce((best, mode) => {
      const bestDelta = Math.abs(SPAWN_MODES[best].pWildcard - pWildcard);
      const nextDelta = Math.abs(SPAWN_MODES[mode].pWildcard - pWildcard);
      return nextDelta < bestDelta ? mode : best;
    }, "normal" as SpawnMode);
  }

  async function importGameFile(file: File) {
    setBusy(true);
    setErrorMessage("");
    try {
      const text = await file.text();
      const payload = toGameImportPayload(JSON.parse(text));
      const res = await fetch("/api/games/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current || !json?.id) {
        const message = getGameImportErrorMessage(res.status, json?.error);
        throw new Error(message);
      }
      applyLoadedSession(json as { id: string; current: GameState; undo?: UndoMeta });
      setNewGameConfirmArmed(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to import game";
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  async function loadReplayFile(file: File) {
    setBusy(true);
    setErrorMessage("");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const parsed = parseReplayExport(payload);
      if (!parsed) throw new Error("Replay file is missing required export fields");
      setReplay({ data: parsed, step: 0, sourceName: file.name });
      setReplayPlaying(false);
      setCellEffects({});
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load replay";
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  async function loadReplayCode(code: string) {
    setBusy(true);
    setErrorMessage("");
    try {
      const decodeRes = await fetch(`/api/replay/code?code=${encodeURIComponent(code)}`);
      const decoded = await decodeRes.json().catch(() => ({}));
      if (!decodeRes.ok) {
        const message =
          decoded && typeof decoded.error === "string" ? decoded.error : "Failed to decode replay code";
        throw new Error(message);
      }

      const runRes = await fetch("/api/sim/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          config: decoded.config,
          initialGrid: decoded.initialGrid,
          moves: decoded.moves
        })
      });
      const replayExport = await runRes.json().catch(() => ({}));
      if (!runRes.ok) {
        const message =
          replayExport && typeof replayExport.error === "string"
            ? replayExport.error
            : "Failed to reconstruct replay";
        throw new Error(message);
      }
      const parsed = parseReplayExport(replayExport);
      if (!parsed) throw new Error("Reconstructed replay payload is invalid");
      setReplay({ data: parsed, step: 0, sourceName: "Shared replay" });
      setReplayPlaying(false);
      setCellEffects({});
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load replay code";
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function finishInitialization() {
      if (cancelled) return;
      setInitializing(false);
      setBusy(false);
      if (pendingNewGameRef.current) {
        pendingNewGameRef.current = false;
        await newGame({ clearSnapshot: true, allowWhileBusy: true });
      }
    }
    async function initializeGame() {
      setBusy(true);
      const suppressed = hasTutorialSuppressCookie(document.cookie);
      setSuppressTutorialReminder(suppressed);
      setTutorialReminder(!suppressed);
      const sharedReplayCode = getReplayCodeFromSearch(window.location.search);
      if (sharedReplayCode) {
        await loadReplayCode(sharedReplayCode);
        await finishInitialization();
        return;
      }
      const savedId = window.localStorage.getItem(gameIdKey);
      if (savedId) {
        const recovered = await recoverFromLocalSnapshot(savedId, { notify: false });
        if (recovered || cancelled) {
          await finishInitialization();
          return;
        }
        const ok = await restoreGame(savedId);
        if (ok || cancelled) {
          await finishInitialization();
          return;
        }
        void trackMarketing("session_resume_miss", "resume", {
          gameId: savedId,
          source: "server"
        });
        void trackMarketing("session_reset_after_resume", "resume", {
          gameId: savedId,
          outcome: "await_new_game"
        });
        window.localStorage.removeItem(gameIdKey);
        clearResumeSnapshot(window.localStorage);
      } else {
        const recovered = await recoverFromLocalSnapshot(undefined, { notify: false });
        if (recovered || cancelled) {
          await finishInitialization();
          return;
        }
      }
      const tutorialPreferenceValue = parseTutorialPreference(
        window.localStorage.getItem(TUTORIAL_STORAGE_KEY)
      );
      if (tutorialPreferenceValue?.status === "active") {
        setTutorial(createTutorialSession(tutorialPreferenceValue.lessonIndex ?? 0));
      }
      await finishInitialization();
    }
    void initializeGame();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const key = "binary2048.referralCode";
    const existing = window.localStorage.getItem(key);
    if (existing) {
      setReferralCode(existing);
      return;
    }
    const next = createReferralCode();
    window.localStorage.setItem(key, next);
    setReferralCode(next);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("binary2048.uiControlOverrides");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as UIControlOverrides;
      if (parsed && typeof parsed === "object") {
        setUiControlOverrides(parsed);
      }
    } catch {
      // Ignore malformed local override payloads.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("binary2048.uiControlOverrides", JSON.stringify(uiControlOverrides));
  }, [uiControlOverrides]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(highScoreKey);
    const parsed = Number(raw ?? "0");
    if (!Number.isNaN(parsed) && parsed > 0) setHighScore(parsed);
    const savedMode = window.localStorage.getItem(modeKey);
    if (savedMode === "normal" || savedMode === "ltfg" || savedMode === "death") {
      setSpawnMode(savedMode);
    }
    const savedGameMode = window.localStorage.getItem(gameModeKey);
    if (savedGameMode === "classic" || savedGameMode === "bitstorm") {
      setGameMode(savedGameMode);
    }
    const savedColorMode = window.localStorage.getItem(colorModeKey);
    if (
      savedColorMode === "default" ||
      savedColorMode === "cb-protanopia" ||
      savedColorMode === "cb-deuteranopia" ||
      savedColorMode === "cb-tritanopia"
    ) {
      setColorMode(savedColorMode);
    }
    const savedThemeMode = window.localStorage.getItem(themeModeKey);
    if (isThemeMode(savedThemeMode)) {
      setThemeMode(savedThemeMode);
    }
  }, []);

  useEffect(() => {
    const score = state?.score ?? 0;
    if (score <= highScore) return;
    setHighScore(score);
    window.sessionStorage.setItem(highScoreKey, String(score));
  }, [state?.score, highScore]);

  useEffect(() => {
    setNewGameConfirmArmed(false);
    setPreparedReplayUrl("");
  }, [gameId, replay, state?.turn, state?.over]);

  useEffect(() => {
    window.localStorage.setItem(modeKey, spawnMode);
  }, [spawnMode]);

  useEffect(() => {
    window.localStorage.setItem(gameModeKey, gameMode);
  }, [gameMode]);

  useEffect(() => {
    window.localStorage.setItem(colorModeKey, colorMode);
    document.documentElement.setAttribute("data-color-mode", colorMode);
  }, [colorMode]);

  useEffect(() => {
    window.localStorage.setItem(themeModeKey, themeMode);
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  useLayoutEffect(() => {
    const pending = pendingPaintTraceRef.current;
    if (!pending || !state || state.turn !== pending.turn) return;
    pendingPaintTraceRef.current = null;
    markMovePerformancePhase(pending.trace, "react_commit");
    paintFrameTraceRef.current = pending.trace;
    paintFrameRef.current = window.requestAnimationFrame(() => {
      paintFrameRef.current = null;
      paintFrameTraceRef.current = null;
      finishMovePerformanceTrace(pending.trace);
    });
  }, [state]);

  useEffect(() => {
    if (busy || moveInFlightRef.current || bufferedMovesRef.current.length === 0) return;
    if (replay || !gameId || !state || state.over || (state.won && !continueAfterWin)) {
      clearBufferedMoves("buffer_cleared_terminal_state");
      return;
    }
    const nextMove = bufferedMovesRef.current.shift();
    if (nextMove) {
      recordMoveQueueDepth(nextMove.trace, "dequeue", bufferedMovesRef.current.length);
      void move(nextMove.dir, nextMove.trace);
    }
  }, [busy, gameId, state, replay, continueAfterWin]);

  keyboardInputHandlerRef.current = (event: KeyboardEvent) => {
    const dir = keyToDir(event.key);
    if (!dir) return;
    if (
      newGameSetupOpen ||
      newGameTutorialChoiceOpen ||
      tutorialLaunchConfirmOpen ||
      tutorialExitConfirmOpen ||
      (tutorial && tutorial.phase !== "active")
    ) {
      dropDirectionalInput(
        dir,
        "keyboard",
        tutorial && tutorial.phase !== "active" ? "tutorial_unavailable" : "modal_open"
      );
      return;
    }
    event.preventDefault();
    void move(dir, startMovePerformanceTrace(dir, "keyboard"));
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      keyboardInputHandlerRef.current(event);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!tutorial || tutorial.phase !== "success") return;
    let remainingMs = TUTORIAL_SUCCESS_DURATION_MS;
    let timerStartedAt: number | null = null;

    const clearAdvanceTimer = () => {
      if (tutorialAdvanceTimerRef.current === null) return;
      window.clearTimeout(tutorialAdvanceTimerRef.current);
      tutorialAdvanceTimerRef.current = null;
      if (timerStartedAt !== null) {
        remainingMs = Math.max(0, remainingMs - (Date.now() - timerStartedAt));
        timerStartedAt = null;
      }
    };
    const advanceTutorial = () => {
      tutorialAdvanceTimerRef.current = null;
      timerStartedAt = null;
      if (document.hidden) return;
      setTutorial((current) => {
        if (!current || current.phase !== "success") return current;
        const next = continueTutorial(current);
        window.localStorage.setItem(
          TUTORIAL_STORAGE_KEY,
          JSON.stringify(tutorialPreference("active", next.lessonIndex))
        );
        return next;
      });
    };
    const scheduleAdvance = () => {
      if (document.hidden || tutorialAdvanceTimerRef.current !== null) return;
      timerStartedAt = Date.now();
      tutorialAdvanceTimerRef.current = window.setTimeout(advanceTutorial, remainingMs);
    };
    const onVisibilityChange = () => {
      if (document.hidden) clearAdvanceTimer();
      else scheduleAdvance();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    scheduleAdvance();
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearAdvanceTimer();
    };
  }, [tutorial]);

  useEffect(() => {
    return () => {
      if (effectTimerRef.current) window.clearTimeout(effectTimerRef.current);
      if (tutorialAdvanceTimerRef.current) window.clearTimeout(tutorialAdvanceTimerRef.current);
      if (paintFrameRef.current !== null) window.cancelAnimationFrame(paintFrameRef.current);
      if (paintFrameTraceRef.current) discardMovePerformanceTrace(paintFrameTraceRef.current);
      if (pendingPaintTraceRef.current) discardMovePerformanceTrace(pendingPaintTraceRef.current.trace);
      clearBufferedMoves("component_unmounted");
    };
  }, []);

  useEffect(() => {
    if (!replay || !replayPlaying) return;
    if (replay.step >= replay.data.steps.length) {
      setReplayPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReplay((prev) => (prev ? { ...prev, step: Math.min(prev.data.steps.length, prev.step + 1) } : prev));
    }, replaySpeedToDelayMs(replaySpeed));
    return () => window.clearTimeout(timer);
  }, [replay, replayPlaying, replaySpeed]);

  function onBoardTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onBoardTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!touchStartRef.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    const dir = swipeToDir(dx, dy, 24);
    if (!dir) return;
    if (
      newGameSetupOpen ||
      newGameTutorialChoiceOpen ||
      tutorialLaunchConfirmOpen ||
      tutorialExitConfirmOpen
    ) {
      dropDirectionalInput(dir, "touch", "modal_open");
      return;
    }
    if (tutorial && tutorial.phase !== "active") {
      dropDirectionalInput(dir, "touch", "tutorial_unavailable");
      return;
    }
    if (replay) {
      dropDirectionalInput(dir, "touch", "replay_active");
      return;
    }
    if (busy) {
      dropDirectionalInput(dir, "touch", "busy");
      return;
    }
    if (!tutorial && !state) {
      dropDirectionalInput(dir, "touch", "game_unavailable");
      return;
    }
    if (!tutorial && state?.over) {
      dropDirectionalInput(dir, "touch", "game_over");
      return;
    }
    if (!tutorial && state?.won && !continueAfterWin) {
      dropDirectionalInput(dir, "touch", "win_continuation_required");
      return;
    }
    void move(dir, startMovePerformanceTrace(dir, "touch"));
  }

  function enterTutorial() {
    clearBufferedMoves("buffer_cleared_tutorial_start");
    window.localStorage.removeItem(gameIdKey);
    clearResumeSnapshot(window.localStorage);
    setGameId("");
    setState(null);
    setReplay(null);
    setNewGameSetupOpen(false);
    setNewGameTutorialChoiceOpen(false);
    setTutorialLaunchConfirmOpen(false);
    setTutorialExitConfirmOpen(false);
    const next = createTutorialSession();
    setTutorial(next);
    window.localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      JSON.stringify(tutorialPreference("active", next.lessonIndex))
    );
  }

  function requestTutorial() {
    if (tutorial) return;
    if (state && !state.over && !state.won) {
      modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTutorialLaunchConfirmOpen(true);
      return;
    }
    enterTutorial();
  }

  function leaveTutorial() {
    setTutorial(null);
    setTutorialExitConfirmOpen(false);
    setGameId("");
    setState(null);
    window.localStorage.removeItem(gameIdKey);
    clearResumeSnapshot(window.localStorage);
    window.localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    setTutorialReminder(!hasTutorialSuppressCookie(document.cookie));
  }

  function requestTutorialExit() {
    if (!tutorial) return;
    if (tutorial.lessonIndex > 0 || tutorial.moveIndex > 0) {
      modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setTutorialExitConfirmOpen(true);
      return;
    }
    leaveTutorial();
  }

  function setTutorialReminderSuppressed(checked: boolean) {
    setSuppressTutorialReminder(checked);
    setTutorialReminder(!checked);
    document.cookie = checked
      ? tutorialSuppressCookie(window.location.protocol === "https:")
      : clearTutorialSuppressCookie(window.location.protocol === "https:");
  }

  function requestNewGameWithTutorialOffer() {
    if (tutorialReminder) {
      modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setNewGameConfirmArmed(false);
      setNewGameTutorialChoiceOpen(true);
      return;
    }
    void newGame();
  }

  function openNewGameSetup() {
    modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setNewGameConfirmArmed(false);
    setNewGameSetupOpen(true);
  }

  const viewState = tutorial?.board ?? (replay ? replayStateAtStep(replay.data, replay.step) : state);
  const wildcardRate = viewState?.config?.spawn?.pWildcard;
  const activeMode = typeof wildcardRate === "number" ? modeFromWildcardRate(wildcardRate) : spawnMode;
  const winPending = Boolean(!tutorial && !replay && state?.won && !continueAfterWin);
  const terminalOverlayBlocked = newGameSetupOpen || newGameTutorialChoiceOpen;
  const isPlayable = Boolean(!replay && state && !state.over && !winPending);
  const isActiveRun = Boolean(!replay && state && !state.over && !winPending && (state.turn ?? 0) > 0);
  const effectiveUiPolicy = applyUiPolicyOverrides(UI_POLICY, uiControlOverrides);
  const controlVisibility = getControlVisibility({
    replay: Boolean(replay || tutorial),
    isPlayable,
    isActiveRun,
    uiPolicy: effectiveUiPolicy
  });
  const toolbarActionState = getToolbarActionState({
    replay: Boolean(replay),
    gameId,
    turn: state?.turn ?? 0,
    over: Boolean(state?.over),
    undoRemaining: undo.remaining ?? 0
  });
  const newGameGuard = getNewGameGuardState({
    replay: Boolean(replay),
    gameId,
    turn: state?.turn ?? 0,
    over: Boolean(state?.over),
    confirmArmed: newGameConfirmArmed
  });
  const replayStepsTotal = replay?.data.steps.length ?? 0;
  const replayStep = replay?.step ?? 0;
  const shareText = buildShareText(viewState?.score ?? 0, highScore, viewState?.turn ?? 0);
  const shareUrl =
    typeof window !== "undefined"
      ? buildShareLandingUrl(window.location.origin, {
          referralCode,
          campaign: "share",
          source: "app",
          medium: "social"
        })
      : "https://binary2048.com";
  const issueReportUrl =
    typeof window !== "undefined"
      ? buildIssueReportUrl({
          origin: window.location.origin,
          pathname: window.location.pathname,
          version: APP_VERSION,
          commit: APP_COMMIT,
          gameId: gameId || undefined,
          spawnMode: activeMode,
          gameMode,
          replay: Boolean(replay)
        })
      : "https://github.com/alankelsey/Binary-2048/issues/new";
  const socialUrls = buildShareUrls(shareText, shareUrl);
  const diagnosticText = GAME_LOG_ENABLED ? formatDiagnosticEntries(diagnosticEntries) : "";

  async function trackMarketing(
    type: MarketingEventType,
    channel: "x" | "linkedin" | "copy" | "replay" | "resume" | "mobile" | "ux",
    metadata?: Record<string, string>
  ) {
    try {
      await fetch("/api/marketing/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          channel,
          campaign: "share",
          referralCode,
          metadata
        })
      });
    } catch {
      // Keep share UX resilient even if tracking fails.
    }
  }

  function handleControlsPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button");
    if (!button) return;

    const control = normalizeAuditControlLabel(button.textContent);
    const rageResult = recordRageTap(controlTapStateRef.current, control, Date.now());
    controlTapStateRef.current = rageResult.next;

    if (rageResult.shouldTrack) {
      void trackMarketing("ux_rage_tap", "ux", {
        area: "actions",
        control,
        mobile: compactMobile ? "true" : "false"
      });
    }

    if ((button as HTMLButtonElement).disabled) {
      void trackMarketing("ux_dead_click", "ux", {
        area: "actions",
        control,
        mobile: compactMobile ? "true" : "false"
      });
    }
  }

  async function copyShare() {
    const copied = await copyTextWithFallback(`${shareText} ${shareUrl}`);
    if (copied) {
      void trackMarketing("copy_share", "copy");
      setShareMessage("Share text copied");
      window.setTimeout(() => setShareMessage(""), 1800);
    } else {
      setShareMessage("Unable to copy share text");
      window.setTimeout(() => setShareMessage(""), 1800);
    }
  }

  async function copyDiagnosticLog() {
    if (!GAME_LOG_ENABLED) return;
    const copied = await copyTextWithFallback(diagnosticText);
    setShareMessage(copied ? "Diagnostic log copied" : "Unable to copy diagnostic log; select the text manually");
    window.setTimeout(() => setShareMessage(""), copied ? 1800 : 2600);
  }

  async function fetchGameExport(compact = false) {
    if (!gameId) throw new Error("No active game to export");
    const recoverySnapshot = loadResumeSnapshot(window.localStorage, gameId);
    const recoveryMoves =
      recoverySnapshot && "recoveryVersion" in recoverySnapshot
        ? recoverySnapshot.moves.length
        : recoverySnapshot?.steps.length ?? null;
    addDiagnostic("export_request", { gameId, compact, recoveryMoves });
    const exportRes = await fetch(`/api/games/${gameId}/export${compact ? "?compact=1" : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recoverySnapshot })
    });
    const exported = await exportRes.json().catch(() => ({}));
    addDiagnostic(
      "export_response",
      {
        gameId,
        compact,
        status: exportRes.status,
        moves: Array.isArray(exported?.moves)
          ? exported.moves.length
          : Array.isArray(exported?.meta?.replay?.moves)
            ? exported.meta.replay.moves.length
            : null,
        hasConfig: Boolean(exported?.config),
        hasInitialGrid: Array.isArray(exported?.initialGrid) || Array.isArray(exported?.initial?.grid),
        error: typeof exported?.error === "string" ? exported.error : null
      },
      exportRes.ok ? "info" : "error"
    );
    if (!exportRes.ok) {
      throw new Error(
        compact
          ? getReplayShareErrorMessage(exportRes.status)
          : exportRes.status === 404
            ? "Current run is no longer available to export. Your local board is still saved."
            : "Failed to export game"
      );
    }
    return { exported, response: exportRes };
  }

  async function exportGameJson() {
    if (busy || !gameId) return;
    try {
      const { exported, response } = await fetchGameExport(false);
      const filename = filenameFromDisposition(
        response.headers.get("content-disposition"),
        `${gameId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
      );
      downloadJson(exported, filename);
      setShareMessage("Game export downloaded");
      window.setTimeout(() => setShareMessage(""), 1800);
    } catch (error) {
      addDiagnostic("export_error", { gameId, message: diagnosticValue(error) }, "error");
      setShareMessage(error instanceof Error ? error.message : "Unable to export game");
      window.setTimeout(() => setShareMessage(""), 2200);
    }
  }

  async function copyReplayLink() {
    if (!gameId) return;
    try {
      if (preparedReplayUrl) {
        const copied = await copyTextWithFallback(preparedReplayUrl);
        if (!copied) throw new Error("Unable to copy replay link; use Open Replay Link");
        setShareMessage("Replay link copied");
        window.setTimeout(() => setShareMessage(""), 1800);
        return;
      }

      const { exported } = await fetchGameExport(true);

      const codeRes = await fetch("/api/replay/code?hosted=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(exported)
      });
      const codeJson = await codeRes.json().catch(() => ({}));
      addDiagnostic(
        "replay_code_response",
        {
          gameId,
          status: codeRes.status,
          hosted: Boolean(codeJson?.hosted),
          codeLength: typeof codeJson?.length === "number" ? codeJson.length : null,
          error: typeof codeJson?.error === "string" ? codeJson.error : null
        },
        codeRes.ok ? "info" : "error"
      );
      if (!codeRes.ok || typeof codeJson?.code !== "string") {
        throw new Error("Failed to create replay code");
      }

      if (codeJson.overLimit) {
        throw new Error("Replay link is too long to share; use Export JSON instead");
      }

      const replayUrl = buildReplayUrl(window.location.origin, codeJson.code);
      setPreparedReplayUrl(replayUrl);
      const copied = await copyTextWithFallback(replayUrl);
      void trackMarketing("copy_replay_link", "replay");
      setShareMessage(copied ? "Replay link copied" : "Replay link ready—tap Copy Replay Link again");
      if (copied) window.setTimeout(() => setShareMessage(""), 1800);
    } catch (error) {
      addDiagnostic("replay_link_error", { gameId, message: diagnosticValue(error) }, "error");
      setShareMessage(error instanceof Error ? error.message : "Unable to copy replay link");
      window.setTimeout(() => setShareMessage(""), 2200);
    }
  }

  async function exitReplay() {
    setReplayPlaying(false);
    setReplay(null);
    if (shouldStartNewGameOnReplayExit(Boolean(state))) {
      await newGame();
    }
  }

  async function toggleFullscreen() {
    if (!fullscreenSupported) return;
    try {
      if (isFullscreenActive(document)) {
        await exitDocumentFullscreen(document);
      } else {
        await requestElementFullscreen(fullscreenShellRef.current);
      }
    } catch {
      setShareMessage("Fullscreen is unavailable on this device");
      window.setTimeout(() => setShareMessage(""), 1800);
    }
  }

  useEffect(() => {
    function syncFullscreenState() {
      setFullscreenActive(isFullscreenActive(document));
      setFullscreenSupported(isFullscreenSupported(fullscreenShellRef.current));
    }

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState as EventListener);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 560px)");

    function syncCompactMobile() {
      setCompactMobile(mediaQuery.matches);
    }

    syncCompactMobile();
    mediaQuery.addEventListener("change", syncCompactMobile);
    return () => mediaQuery.removeEventListener("change", syncCompactMobile);
  }, []);

  useEffect(() => {
    if (compactMobile && !replay) {
      setMobileControlsOpen(false);
    }
  }, [compactMobile, replay, viewState?.turn]);

  useEffect(() => {
    if (!difficultyHelpOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDifficultyHelpOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [difficultyHelpOpen]);

  useEffect(() => {
    if (!newGameSetupOpen && !newGameTutorialChoiceOpen && !tutorialLaunchConfirmOpen && !tutorialExitConfirmOpen) return;
    function onModalKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (newGameSetupOpen && state) setNewGameSetupOpen(false);
      if (newGameTutorialChoiceOpen) setNewGameTutorialChoiceOpen(false);
      if (tutorialLaunchConfirmOpen) setTutorialLaunchConfirmOpen(false);
      if (tutorialExitConfirmOpen) setTutorialExitConfirmOpen(false);
    }
    document.addEventListener("keydown", onModalKeyDown);
    return () => document.removeEventListener("keydown", onModalKeyDown);
  }, [newGameSetupOpen, newGameTutorialChoiceOpen, tutorialLaunchConfirmOpen, tutorialExitConfirmOpen, state]);

  useEffect(() => {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'));
    const dialog = dialogs.at(-1);
    if (!dialog) return;
    const modalDialog = dialog;

    const focusableSelector =
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(modalDialog.querySelectorAll<HTMLElement>(focusableSelector));

    if (!modalDialog.contains(document.activeElement)) {
      (focusable()[0] ?? modalDialog).focus();
    }

    function keepFocusInDialog(event: FocusEvent) {
      if (event.target instanceof Node && modalDialog.contains(event.target)) return;
      (focusable()[0] ?? modalDialog).focus();
    }

    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (controls.length === 0) {
        event.preventDefault();
        modalDialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("focusin", keepFocusInDialog);
    document.addEventListener("keydown", trapTab);
    return () => {
      document.removeEventListener("focusin", keepFocusInDialog);
      document.removeEventListener("keydown", trapTab);
      const trigger = modalTriggerRef.current;
      window.queueMicrotask(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    };
  }, [
    newGameSetupOpen,
    newGameTutorialChoiceOpen,
    tutorialLaunchConfirmOpen,
    tutorialExitConfirmOpen,
    tutorial?.phase,
    tutorial?.lessonIndex,
    state?.over,
    state?.won,
    winPending
  ]);

  useEffect(() => {
    setDifficultyHelpOpen(false);
  }, [mobileControlsOpen]);

  return (
    <main>
      <a className="skip-link" href="#game-controls">
        Skip to game controls
      </a>
      {!tutorial ? <header className="brand">
        <Binary2048Logo />
        <div>
          <h1>Binary 2048</h1>
          <p className="brand-subtitle">Merge bits. Control chaos. Reach 2048.</p>
        </div>
      </header> : null}
      {!tutorial ? <p className="tagline">Made mostly for bots by mostly bots: Bonus tiles: zero annihilator + wildcard multipliers.</p> : null}
      <div ref={fullscreenShellRef} className={`fullscreen-shell ${fullscreenActive ? "fullscreen-active" : ""}`}>
        <div className="card" aria-busy={busy}>
        {!tutorial ? <div className="meta">
          <span>Game: {tutorial ? "Tutorial" : replay ? `Replay (${replay.sourceName})` : gameId || "-"}</span>
          <span className="score-pill">Score: {viewState?.score ?? 0}</span>
          <span>Moves: {viewState?.turn ?? 0}</span>
          <span>High: {highScore}</span>
          <span>Difficulty: {SPAWN_MODES[activeMode].label}</span>
          <span>Mode: {GAME_MODES[gameMode].label}</span>
          <span>{tutorial ? "Tutorial" : replay ? "Replay" : state?.won ? "Won" : state?.over ? "Game Over" : "Active"}</span>
        </div> : (
          <div className="tutorial-status-bar">
            <span>Lesson {tutorial.lessonIndex + 1} of {TUTORIAL_LESSONS.length}</span>
            <span>{TUTORIAL_LESSONS[tutorial.lessonIndex].title}</span>
            <button type="button" onClick={requestTutorialExit}>Quit tutorial</button>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
            {tutorial
              ? `Tutorial lesson ${tutorial.lessonIndex + 1} of ${TUTORIAL_LESSONS.length}. ${tutorial.feedback}`
              : replay
            ? `Replay step ${replayStep} of ${replayStepsTotal}. Score ${viewState?.score ?? 0}. Moves ${viewState?.turn ?? 0}.`
            : `Game ${gameId || "-"}, score ${viewState?.score ?? 0}, moves ${viewState?.turn ?? 0}, ${
                viewState?.over ? "game over" : viewState?.won ? "won" : "active"
              }.`}
        </p>
        {replay ? (
          <div className="replay-controls">
            <span>
              Replay step {replayStep}/{replayStepsTotal}
            </span>
            <label className="replay-scrubber-wrap">
              <span>Timeline</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, replayStepsTotal)}
                step={1}
                value={replayStep}
                aria-label="Replay timeline scrubber"
                onChange={(event) => {
                  const nextStep = parseReplayStepInput(event.target.value, replayStepsTotal);
                  setReplayPlaying(false);
                  setReplay((prev) => (prev ? { ...prev, step: nextStep } : prev));
                }}
              />
              <span className="replay-scrubber-readout">
                {replayStep}/{replayStepsTotal}
              </span>
            </label>
            <button
              disabled={busy}
              onClick={() => {
                setReplayPlaying((prevPlaying) => {
                  const nextPlaying = !prevPlaying;
                  if (nextPlaying && replayStep >= replayStepsTotal) {
                    setReplay((prev) => (prev ? { ...prev, step: 0 } : prev));
                  }
                  return nextPlaying;
                });
              }}
            >
              {replayPlaying ? "Pause" : "Play"}
            </button>
            <label className="replay-speed-wrap">
              <span>Speed {replaySpeed}</span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={replaySpeed}
                onChange={(event) => setReplaySpeed(Number(event.target.value))}
                aria-label="Replay speed"
              />
            </label>
            <button
              disabled={busy || replayStep <= 0}
              onClick={() => {
                setReplayPlaying(false);
                setReplay((prev) => (prev ? { ...prev, step: 0 } : prev));
              }}
            >
              First
            </button>
            <button
              disabled={busy || replayStep <= 0}
              onClick={() => {
                setReplayPlaying(false);
                setReplay((prev) => (prev ? { ...prev, step: Math.max(0, prev.step - 1) } : prev));
              }}
            >
              Prev
            </button>
            <button
              disabled={busy || replayStep >= replayStepsTotal}
              onClick={() => {
                setReplayPlaying(false);
                setReplay((prev) => (prev ? { ...prev, step: Math.min(prev.data.steps.length, prev.step + 1) } : prev));
              }}
            >
              Next
            </button>
            <button
              disabled={busy || replayStep >= replayStepsTotal}
              onClick={() => {
                setReplayPlaying(false);
                setReplay((prev) => (prev ? { ...prev, step: prev.data.steps.length } : prev));
              }}
            >
              Last
            </button>
            <button disabled={busy} onClick={() => void exitReplay()}>
              Exit Replay
            </button>
          </div>
        ) : null}
        {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
        <div className={`board-shell ${viewState?.over ? "game-over" : ""} ${winPending ? "game-won" : ""}`}>
          <div
            className="board"
            style={{ gridTemplateColumns: `repeat(${viewState?.width ?? 4}, minmax(0, 1fr))` }}
            onTouchStart={onBoardTouchStart}
            onTouchEnd={onBoardTouchEnd}
            role="grid"
            aria-label={tutorial ? "Binary 2048 tutorial board" : "Binary 2048 game board"}
          >
            {(viewState?.grid ?? Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null))).map((row, r) =>
              row.map((cell, c) => {
                const effect = cellEffects[`${r}-${c}`];
                const effectClass = effect ? `fx-${effect}` : "";
                const tutorialFocus = Boolean(
                  tutorial && TUTORIAL_LESSONS[tutorial.lessonIndex].focusCells.some(([row, col]) => row === r && col === c)
                );
                const tileLabel = cell
                  ? cell.t === "n"
                    ? `number ${cell.v}`
                    : cell.t === "z"
                      ? "zero"
                      : cell.t === "i"
                        ? "lock zero"
                      : "wildcard"
                  : "empty";
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`cell ${cell ? "filled" : "empty"} ${cellTypeClass(cell)} ${effectClass} ${tutorialFocus ? "tutorial-focus-cell" : ""}`}
                    style={numberTileStyle(cell)}
                    role="gridcell"
                    aria-label={`row ${r + 1} column ${c + 1} ${tileLabel}`}
                  >
                    {cell?.t === "w" ? (
                      <span className="wild-icon" aria-label="wildcard tile">
                        ✦<small>2×</small>
                      </span>
                    ) : cell?.t === "i" ? (
                      <span className="lock-icon" aria-label="lock zero tile">
                        ⛓<small>Lock</small>
                      </span>
                    ) : (
                      label(cell)
                    )}
                  </div>
                );
              })
            )}
          </div>
          {tutorial?.phase === "coach" ? (
            <div className="newgame-overlay tutorial-coach" role="dialog" aria-modal="true" aria-labelledby="tutorial-coach-title" aria-describedby="tutorial-coach-copy">
              <div className="tutorial-progress">Lesson {tutorial.lessonIndex + 1} of {TUTORIAL_LESSONS.length}</div>
              <div className="newgame-title" id="tutorial-coach-title">{TUTORIAL_LESSONS[tutorial.lessonIndex].title}</div>
              {TUTORIAL_LESSONS[tutorial.lessonIndex].tileName ? (
                <strong className="tutorial-tile-name">{TUTORIAL_LESSONS[tutorial.lessonIndex].tileName}</strong>
              ) : null}
              <p className="newgame-copy" id="tutorial-coach-copy">{TUTORIAL_LESSONS[tutorial.lessonIndex].instruction}</p>
              <div className="tutorial-swipe-arrow" data-direction={tutorialExpectedDirection(tutorial)} aria-hidden="true">➜</div>
              <div className="tutorial-actions">
                <button type="button" className="primary-action" autoFocus onClick={() => setTutorial((current) => current ? armTutorial(current) : current)}>Try it</button>
                <button type="button" onClick={requestTutorialExit}>Quit tutorial</button>
              </div>
            </div>
          ) : null}
          {tutorial?.phase === "success" ? (
            <div className="tutorial-success" role="status" aria-live="polite">
              {tutorial.feedback}
            </div>
          ) : null}
          {tutorial?.phase === "active" && tutorial.feedback ? (
            <div className="tutorial-feedback-float" role="status" aria-live="polite">{tutorial.feedback}</div>
          ) : null}
          {tutorial?.phase === "completed" ? (
            <div className="newgame-overlay tutorial-complete" role="dialog" aria-modal="true" aria-labelledby="tutorial-complete-title">
              <div className="win-burst" aria-hidden="true" />
              <div className="newgame-title" id="tutorial-complete-title">You made 2048!</div>
              <ul className="tutorial-complete-summary">
                <li>Move and merge matching number tiles.</li>
                <li>Zero annihilates a collision.</li>
                <li>The 2× wildcard multiplies a number.</li>
                <li>Lock-0 blocks once, then breaks like zero.</li>
              </ul>
              <div className="tutorial-actions">
                <button type="button" className="primary-action" autoFocus onClick={leaveTutorial}>Start playing</button>
                <button type="button" onClick={enterTutorial}>Replay tutorial</button>
              </div>
            </div>
          ) : null}
          <GameOverOverlay
            visible={Boolean(!tutorial && !terminalOverlayBlocked && viewState?.over)}
            score={viewState?.score ?? 0}
            highScore={Math.max(highScore, viewState?.score ?? 0)}
            onNewGame={openNewGameSetup}
            onTutorial={requestTutorial}
            onReplay={effectiveUiPolicy.controls.import ? () => replayInputRef.current?.click() : undefined}
          />
          <NewGameOverlay
            visible={!initializing && !tutorial && !newGameTutorialChoiceOpen && !replay && (newGameSetupOpen || !state)}
            starting={startNewGamePending || busy}
            onStart={requestNewGameWithTutorialOffer}
            onTutorial={requestTutorial}
            onBack={state ? () => setNewGameSetupOpen(false) : undefined}
          >
            <div className="newgame-settings options-grid" aria-label="New game choices">
              <div className="difficulty-select-wrap">
                <span id="new-game-difficulty-label" className="difficulty-label">Difficulty</span>
                <button
                  type="button"
                  className="field-help"
                  aria-expanded={difficultyHelpOpen}
                  aria-controls="difficulty-help-note"
                  onClick={() => setDifficultyHelpOpen((open) => !open)}
                >
                  <span aria-hidden="true">?</span>
                  <span className="sr-only">{difficultyHelpOpen ? "Hide difficulty help" : "Show difficulty help"}</span>
                </button>
                <select
                  id="new-game-difficulty"
                  aria-labelledby="new-game-difficulty-label"
                  className={`difficulty-select mode-${spawnMode}`}
                  value={spawnMode}
                  onChange={(event) => setSpawnMode(event.target.value as SpawnMode)}
                >
                  <option value="normal">{SPAWN_MODES.normal.label}</option>
                  <option value="ltfg">{SPAWN_MODES.ltfg.label}</option>
                  <option value="death">{SPAWN_MODES.death.label}</option>
                </select>
              </div>
              {difficultyHelpOpen ? <p id="difficulty-help-note" className="field-help-note" role="note">{DIFFICULTY_HELP_TEXT}</p> : null}
              <label className="color-mode-wrap">
                <span className="difficulty-label">Color</span>
                <select aria-label="Color mode" value={colorMode} onChange={(event) => setColorMode(event.target.value as ColorMode)}>
                  <option value="default">Default</option>
                  <option value="cb-protanopia">CB Protanopia</option>
                  <option value="cb-deuteranopia">CB Deuteranopia</option>
                  <option value="cb-tritanopia">CB Tritanopia</option>
                </select>
              </label>
              <label className="theme-mode-wrap">
                <span className="difficulty-label">Theme</span>
                <select aria-label="Theme mode" value={themeMode} onChange={(event) => setThemeMode(event.target.value as ThemeMode)}>
                  {Object.entries(THEMES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                </select>
              </label>
              <label className="mode-select-wrap">
                <span className="difficulty-label">Mode</span>
                <select aria-label="Game mode" value={gameMode} onChange={(event) => setGameMode(event.target.value as GameMode)}>
                  <option value="classic">{GAME_MODES.classic.label}</option>
                  <option value="bitstorm">{GAME_MODES.bitstorm.label}</option>
                </select>
              </label>
              <label className="tutorial-suppress-choice">
                <input
                  type="checkbox"
                  checked={!suppressTutorialReminder}
                  onChange={(event) => setTutorialReminderSuppressed(!event.target.checked)}
                />
                Offer tutorial before new games
              </label>
              {shouldShowImportJson(effectiveUiPolicy.controls.import, authenticated) ? (
                <button type="button" onClick={() => importInputRef.current?.click()}>Import JSON</button>
              ) : null}
              {effectiveUiPolicy.controls.import ? (
                <button type="button" onClick={() => replayInputRef.current?.click()}>Replay JSON</button>
              ) : null}
            </div>
          </NewGameOverlay>
          <WinOverlay
            visible={winPending && !terminalOverlayBlocked}
            score={viewState?.score ?? 0}
            highScore={Math.max(highScore, viewState?.score ?? 0)}
            sessionClass={sessionClass}
            canContinue={canContinueAfterWin}
            onContinue={() => {
              setContinueAfterWin(true);
            }}
            onNewGame={openNewGameSetup}
            onTutorial={requestTutorial}
            onReplay={effectiveUiPolicy.controls.import ? () => replayInputRef.current?.click() : undefined}
          />
          {newGameTutorialChoiceOpen ? (
            <div className="newgame-overlay tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="new-game-tutorial-title">
              <div className="newgame-title" id="new-game-tutorial-title">PLAY THE TUTORIAL?</div>
              <p className="newgame-copy">Learn movement and every special tile before starting a new game.</p>
              <label className="tutorial-suppress-choice">
                <input
                  type="checkbox"
                  checked={suppressTutorialReminder}
                  onChange={(event) => setTutorialReminderSuppressed(event.target.checked)}
                />
                Don&apos;t offer this before new games
              </label>
              <div className="tutorial-actions">
                <button type="button" className="primary-action" autoFocus onClick={enterTutorial}>Play tutorial</button>
                <button type="button" onClick={() => void newGame()}>Start game</button>
                <button type="button" onClick={() => setNewGameTutorialChoiceOpen(false)}>Back</button>
              </div>
            </div>
          ) : null}
          {tutorialLaunchConfirmOpen ? (
            <div className="newgame-overlay tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-launch-title">
              <div className="newgame-title" id="tutorial-launch-title">END CURRENT GAME?</div>
              <p className="newgame-copy">Starting the tutorial will end this run and clear its resumable snapshot.</p>
              <div className="tutorial-actions">
                <button type="button" onClick={enterTutorial}>End game and start tutorial</button>
                <button type="button" autoFocus onClick={() => setTutorialLaunchConfirmOpen(false)}>Keep playing</button>
              </div>
            </div>
          ) : null}
          {tutorialExitConfirmOpen ? (
            <div className="newgame-overlay tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-exit-title">
              <div className="newgame-title" id="tutorial-exit-title">EXIT TUTORIAL?</div>
              <p className="newgame-copy">Your tutorial progress will end and no game will start automatically.</p>
              <div className="tutorial-actions">
                <button type="button" onClick={leaveTutorial}>Leave tutorial</button>
                <button type="button" autoFocus onClick={() => setTutorialExitConfirmOpen(false)}>Keep learning</button>
              </div>
            </div>
          ) : null}
        </div>
        <div onPointerDownCapture={handleControlsPointerDown}>
        <div className="actions actions-primary" id="game-controls">
          {state ? (
            <button
              disabled={toolbarActionState.disableNewGame || startNewGamePending}
              className={newGameGuard.requiresConfirm && newGameConfirmArmed ? "danger-armed" : ""}
              onClick={() => {
                if (!newGameGuard.shouldStartNewGame) {
                  void trackMarketing(compactMobile ? "ux_mobile_mis_tap" : "ux_accidental_tap", "ux", {
                    area: "actions",
                    control: "new_game",
                    guard: "confirm",
                    mobile: compactMobile ? "true" : "false"
                  });
                  setNewGameConfirmArmed(newGameGuard.nextConfirmArmed);
                  return;
                }
                openNewGameSetup();
              }}
            >
              {startNewGamePending ? "Starting…" : newGameGuard.label}
            </button>
          ) : null}
          {controlVisibility.showUndo ? (
            <button disabled={toolbarActionState.disableUndo} onClick={() => void undoMove()}>
              Undo {undo.remaining}
            </button>
          ) : null}
          {FULLSCREEN_TOGGLE_ENABLED && fullscreenSupported ? (
            <button type="button" className="fullscreen-toggle" onClick={() => void toggleFullscreen()}>
              {fullscreenActive ? "Exit Fullscreen" : "Fullscreen"}
            </button>
          ) : null}
          {!replay && !tutorial && Boolean(state) && compactMobile ? (
            <button
              type="button"
              className="mobile-controls-toggle"
              aria-expanded={mobileControlsOpen}
              aria-controls="game-controls-more"
              onClick={() =>
                setMobileControlsOpen((open) => {
                  const nextOpen = !open;
                  void trackMarketing("mobile_controls_toggle", "mobile", {
                    state: nextOpen ? "open" : "closed",
                    fullscreen: fullscreenActive ? "true" : "false"
                  });
                  return nextOpen;
                })
              }
            >
              {mobileControlsOpen ? "Hide More" : "More"}
            </button>
          ) : null}
        </div>
        <div
          className={`actions actions-secondary ${compactMobile && !replay && !mobileControlsOpen ? "mobile-collapsed" : ""}`}
          id="game-controls-more"
        >
          {!replay && !tutorial && Boolean(state) ? (
            <button type="button" onClick={requestTutorial}>Tutorial</button>
          ) : null}
          {controlVisibility.showActiveExport ? (
            <>
              <button
                disabled={!gameId}
                onClick={() => {
                  void exportGameJson();
                }}
              >
                Export JSON
              </button>
              <button
                disabled={toolbarActionState.disableReplayImport}
                onClick={() => {
                  if (busy) return;
                  replayInputRef.current?.click();
                }}
              >
                Replay JSON
              </button>
            </>
          ) : null}
          {UI_POLICY.allOnInDev || UI_POLICY.adminMode ? (
            <details className="options-panel">
              <summary>Dev Controls</summary>
              <div className="options-grid">
                {(["difficulty", "color", "mode", "import", "export"] as UIControl[]).map((control) => (
                  <label key={control} className="difficulty-select-wrap">
                    <span className="difficulty-label">{control}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(effectiveUiPolicy.controls[control])}
                      onChange={(event) =>
                        setUiControlOverrides((prev) => ({
                          ...prev,
                          [control]: event.target.checked
                        }))
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setUiControlOverrides({});
                  }}
                >
                  Reset
                </button>
              </div>
            </details>
          ) : null}
          {authenticated ? (
            <input
              ref={importInputRef}
              data-testid="import-json-input"
              type="file"
              accept="application/json,.json"
              className="file-input-hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void importGameFile(file);
              }}
            />
          ) : null}
          <input
            ref={replayInputRef}
            type="file"
            accept="application/json,.json"
            className="file-input-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void loadReplayFile(file);
            }}
          />
        </div>
        </div>
        {GAME_LOG_ENABLED ? <section className="diagnostics-panel" aria-label="Game diagnostics">
          <div className="diagnostics-header">
            <strong>Game Log ({diagnosticEntries.length})</strong>
            <div className="diagnostics-actions">
              <button
                type="button"
                aria-expanded={diagnosticsOpen}
                aria-controls="game-diagnostics-log"
                onClick={() => setDiagnosticsOpen((open) => !open)}
              >
                {diagnosticsOpen ? "Hide Log" : "Show Log"}
              </button>
              <button type="button" onClick={() => void copyDiagnosticLog()}>
                Copy Log
              </button>
              <button type="button" onClick={() => setDiagnosticEntries([])}>
                Clear Log
              </button>
            </div>
          </div>
          {diagnosticsOpen ? (
            <textarea
              id="game-diagnostics-log"
              className="diagnostics-log"
              aria-label="Game diagnostic log"
              readOnly
              rows={10}
              value={diagnosticText}
            />
          ) : null}
        </section> : null}
        <details className="game-hint">
          <summary>How to play: Swipe on mobile or use arrow keys/WASD. Keep your strongest chain organized.</summary>
          <div className="game-hint-body">
            <p>Basic moves: all tiles slide in one direction per turn.</p>
            <p>`0` tiles annihilate when they collide with any tile. `0+0` also vanishes.</p>
            <p>`Lock-0` (`⛓`) blocks one collision turn, then behaves like `0` on the next moved turn.</p>
            <p>Wildcard tiles (`✦`) double any number tile they collide with, then disappear.</p>
            <p>Game ends when no empty cells and no valid merges remain.</p>
            <p>Tip: keep your highest value anchored to one side and avoid breaking the chain.</p>
          </div>
        </details>
        <div className="share-row" aria-label="share actions">
          <span>Share:</span>
          <button
            type="button"
            onClick={() => {
              void trackMarketing("share_click", "x");
              window.open(socialUrls.x, "_blank", "noopener,noreferrer");
            }}
          >
            X
          </button>
          <button
            type="button"
            onClick={() => {
              void trackMarketing("share_click", "linkedin");
              window.open(socialUrls.linkedin, "_blank", "noopener,noreferrer");
            }}
          >
            LinkedIn
          </button>
          <button type="button" onClick={() => void copyShare()}>
            Copy
          </button>
          <button type="button" disabled={!gameId} onClick={() => void copyReplayLink()}>
            Copy Replay Link
          </button>
          {preparedReplayUrl ? (
            <a href={preparedReplayUrl} target="_blank" rel="noopener noreferrer">
              Open Replay Link
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => {
              window.open(issueReportUrl, "_blank", "noopener,noreferrer");
            }}
          >
            Report Issue
          </button>
          {shareMessage ? <span className="share-status">{shareMessage}</span> : null}
        </div>
        <p className="build-version" aria-label="app version">
          v{APP_VERSION} ({APP_COMMIT})
        </p>
        </div>
      </div>
    </main>
  );
}
