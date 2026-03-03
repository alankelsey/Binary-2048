"use client";

import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import { computeCellEffects, type CellEffect, type MoveEvent } from "@/lib/binary2048/cell-effects";
import { keyToDir, swipeToDir } from "@/lib/binary2048/input";
import { getUiPolicy } from "@/lib/binary2048/ui-policy";
import { parseReplayExport, replayStateAtStep, type ReplayData } from "@/lib/binary2048/replay";
import { buildShareText, buildShareUrls } from "@/lib/binary2048/share";
import { isThemeMode, THEMES, type ThemeMode } from "@/lib/binary2048/theme";

type Tile = { t: "n"; v: number } | { t: "z" } | { t: "w"; m: number };
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
    };
  };
  score: number;
  turn: number;
  won: boolean;
  over: boolean;
  grid: Cell[][];
};
type UndoMeta = { limit: number; used: number; remaining: number };

const SPAWN_MODES: Record<
  SpawnMode,
  {
    label: string;
    pWildcard: number;
  }
> = {
  normal: { label: "Normal", pWildcard: 0.1 },
  ltfg: { label: "LTFG", pWildcard: 0.2 },
  death: { label: "Death by AI", pWildcard: 0.04 }
};
const GAME_MODES: Record<GameMode, { label: string }> = {
  classic: { label: "Classic" },
  bitstorm: { label: "Bitstorm" }
};
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";
const UI_POLICY = getUiPolicy();

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
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [highScore, setHighScore] = useState(0);
  const [spawnMode, setSpawnMode] = useState<SpawnMode>("normal");
  const [colorMode, setColorMode] = useState<ColorMode>("default");
  const [themeMode, setThemeMode] = useState<ThemeMode>("midnight");
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [cellEffects, setCellEffects] = useState<Record<string, CellEffect>>({});
  const [undo, setUndo] = useState<UndoMeta>({ limit: 2, used: 0, remaining: 2 });
  const [replay, setReplay] = useState<{ data: ReplayData; step: number; sourceName: string } | null>(null);
  const [shareMessage, setShareMessage] = useState<string>("");
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const effectTimerRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const replayInputRef = useRef<HTMLInputElement | null>(null);

  async function newGame() {
    setReplay(null);
    setBusy(true);
    setErrorMessage("");
    try {
      const pZero = 0.15;
      const pWildcard = SPAWN_MODES[spawnMode].pWildcard;
      const pOne = 1 - pZero - pWildcard;
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: gameMode,
          config: {
            spawn: {
              pZero,
              pOne,
              pWildcard,
              wildcardMultipliers: [2]
            }
          }
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current || !json?.id) {
        const message = (json && typeof json.error === "string" ? json.error : "Failed to create game");
        throw new Error(message);
      }
      setGameId(json.id);
      setState(json.current);
      if (json?.undo) setUndo(json.undo as UndoMeta);
      const wildcardRate = json?.current?.config?.spawn?.pWildcard;
      if (typeof wildcardRate === "number") setSpawnMode(modeFromWildcardRate(wildcardRate));
      setCellEffects({});
      window.localStorage.setItem(gameIdKey, json.id);
      window.localStorage.setItem(modeKey, spawnMode);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create game");
    } finally {
      setBusy(false);
    }
  }

  async function restoreGame(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/games/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current || json?.id !== id) return false;
      setGameId(id);
      const restored = json.current as GameState;
      setState(restored);
      if (json?.undo) setUndo(json.undo as UndoMeta);
      const wildcardRate = restored?.config?.spawn?.pWildcard;
      if (typeof wildcardRate === "number") setSpawnMode(modeFromWildcardRate(wildcardRate));
      setCellEffects({});
      setErrorMessage("");
      return true;
    } catch {
      return false;
    }
  }

  async function move(dir: Dir) {
    if (replay || !gameId || !state || state.over) return;
    const previous = state;
    setBusy(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/games/${gameId}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current) {
        const message = (json && typeof json.error === "string" ? json.error : "Failed to apply move");
        if (res.status === 404) {
          // Session may be gone in dev/serverless contexts; create a fresh game.
          window.localStorage.removeItem(gameIdKey);
          await newGame();
          return;
        }
        throw new Error(message);
      }
      const next = json.current as GameState;
      if (json?.undo) setUndo(json.undo as UndoMeta);
      const events = Array.isArray(json?.lastStep?.events) ? (json.lastStep.events as MoveEvent[]) : [];
      setState(next);
      startCellEffects(computeCellEffects(previous, next, events, dir));
      if (next.over || next.won) {
        window.localStorage.removeItem(gameIdKey);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to apply move");
    } finally {
      setBusy(false);
    }
  }

  async function undoMove() {
    if (replay || !gameId) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/games/${gameId}/undo`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current) {
        const message = (json && typeof json.error === "string" ? json.error : "Failed to undo move");
        throw new Error(message);
      }
      setState(json.current as GameState);
      if (json?.undo) setUndo(json.undo as UndoMeta);
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
    return String(cell.v);
  }

  function cellTypeClass(cell: Cell): string {
    if (!cell) return "cell-empty";
    if (cell.t === "w") return "tile-wild";
    if (cell.t === "z") return "tile-zero";
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
      const payload = JSON.parse(text);
      const res = await fetch("/api/games/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current || !json?.id) {
        const message = (json && typeof json.error === "string" ? json.error : "Failed to import game");
        throw new Error(message);
      }
      setGameId(json.id);
      setState(json.current);
      if (json?.undo) setUndo(json.undo as UndoMeta);
      setCellEffects({});
      window.localStorage.setItem(gameIdKey, json.id);

      const importedRate = json?.current?.config?.spawn?.pWildcard;
      if (typeof importedRate === "number") {
        const inferredMode = modeFromWildcardRate(importedRate);
        setSpawnMode(inferredMode);
        window.localStorage.setItem(modeKey, inferredMode);
      }
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
      setCellEffects({});
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to load replay";
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initializeGame() {
      setBusy(true);
      const savedId = window.localStorage.getItem(gameIdKey);
      if (savedId) {
        const ok = await restoreGame(savedId);
        if (ok || cancelled) {
          setBusy(false);
          return;
        }
      }
      if (!cancelled) await newGame();
      if (!cancelled) setBusy(false);
    }
    void initializeGame();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const dir = keyToDir(event.key);
      if (!dir) return;
      event.preventDefault();
      void move(dir);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameId, state, busy]);

  useEffect(() => {
    return () => {
      if (effectTimerRef.current) window.clearTimeout(effectTimerRef.current);
    };
  }, []);

  function onBoardTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onBoardTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!touchStartRef.current || replay || busy || !state || state.over) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dir = swipeToDir(dx, dy, 24);
    if (!dir) return;
    void move(dir);
  }

  const viewState = replay ? replayStateAtStep(replay.data, replay.step) : state;
  const wildcardRate = viewState?.config?.spawn?.pWildcard;
  const activeMode = typeof wildcardRate === "number" ? modeFromWildcardRate(wildcardRate) : spawnMode;
  const difficultyLocked = Boolean(state && !state.over && !state.won && (state.turn ?? 0) > 0);
  const isPlayable = Boolean(!replay && state && !state.over && !state.won);
  const isActiveRun = Boolean(!replay && state && !state.over && !state.won && (state.turn ?? 0) > 0);
  const canUndo = Boolean(!replay && gameId && state && (state.turn ?? 0) > 0 && (undo.remaining ?? 0) > 0 && !busy);
  const replayStepsTotal = replay?.data.steps.length ?? 0;
  const replayStep = replay?.step ?? 0;
  const shareText = buildShareText(viewState?.score ?? 0, highScore, viewState?.turn ?? 0);
  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://binary2048.com";
  const socialUrls = buildShareUrls(shareText, shareUrl);

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setShareMessage("Share text copied");
      window.setTimeout(() => setShareMessage(""), 1800);
    } catch {
      setShareMessage("Unable to copy share text");
      window.setTimeout(() => setShareMessage(""), 1800);
    }
  }

  return (
    <main>
      <a className="skip-link" href="#game-controls">
        Skip to game controls
      </a>
      <header className="brand">
        <Binary2048Logo />
        <div>
          <h1>Binary 2048</h1>
          <p className="brand-subtitle">Merge bits. Control chaos. Reach 2048.</p>
        </div>
      </header>
      <p>Arrow keys or WASD combine tiles. Bonus tiles: zero annihilator + wildcard multipliers.</p>
      <div className="card">
        <div className="meta">
          <span>Game: {replay ? `Replay (${replay.sourceName})` : gameId || "-"}</span>
          <span className="score-pill">Score: {viewState?.score ?? 0}</span>
          <span>Moves: {viewState?.turn ?? 0}</span>
          <span>High: {highScore}</span>
          <span>Difficulty: {SPAWN_MODES[activeMode].label}</span>
          <span>Mode: {GAME_MODES[gameMode].label}</span>
          <span>{replay ? "Replay" : state?.won ? "Won" : state?.over ? "Game Over" : "Active"}</span>
        </div>
        <p className="sr-only" aria-live="polite">
          {replay
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
            <button disabled={busy || replayStep <= 0} onClick={() => setReplay((prev) => (prev ? { ...prev, step: 0 } : prev))}>
              First
            </button>
            <button
              disabled={busy || replayStep <= 0}
              onClick={() => setReplay((prev) => (prev ? { ...prev, step: Math.max(0, prev.step - 1) } : prev))}
            >
              Prev
            </button>
            <button
              disabled={busy || replayStep >= replayStepsTotal}
              onClick={() => setReplay((prev) => (prev ? { ...prev, step: Math.min(prev.data.steps.length, prev.step + 1) } : prev))}
            >
              Next
            </button>
            <button
              disabled={busy || replayStep >= replayStepsTotal}
              onClick={() => setReplay((prev) => (prev ? { ...prev, step: prev.data.steps.length } : prev))}
            >
              Last
            </button>
            <button disabled={busy} onClick={() => setReplay(null)}>
              Exit Replay
            </button>
          </div>
        ) : null}
        {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
        <div className={`board-shell ${viewState?.over ? "game-over" : ""}`}>
          <div
            className="board"
            style={{ gridTemplateColumns: `repeat(${viewState?.width ?? 4}, minmax(0, 1fr))` }}
            onTouchStart={onBoardTouchStart}
            onTouchEnd={onBoardTouchEnd}
            role="grid"
            aria-label="Binary 2048 game board"
          >
            {viewState?.grid.map((row, r) =>
              row.map((cell, c) => {
                const effect = cellEffects[`${r}-${c}`];
                const effectClass = effect ? `fx-${effect}` : "";
                const tileLabel = cell
                  ? cell.t === "n"
                    ? `number ${cell.v}`
                    : cell.t === "z"
                      ? "zero"
                      : "wildcard"
                  : "empty";
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`cell ${cell ? "filled" : "empty"} ${cellTypeClass(cell)} ${effectClass}`}
                    style={numberTileStyle(cell)}
                    role="gridcell"
                    aria-label={`row ${r + 1} column ${c + 1} ${tileLabel}`}
                  >
                    {cell?.t === "w" ? (
                      <span className="wild-icon" aria-label="wildcard tile">
                        ✦
                      </span>
                    ) : (
                      label(cell)
                    )}
                  </div>
                );
              })
            )}
          </div>
          {viewState?.over ? (
            <div className="gameover-overlay" role="status" aria-live="polite">
              <div className="gameover-title">GAME OVER</div>
              <div className="gameover-stats">
                <span>Score: {viewState.score}</span>
                <span>High: {Math.max(highScore, viewState.score)}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="actions" id="game-controls">
          <button disabled={busy} onClick={() => void newGame()}>
            New Game
          </button>
          {isPlayable ? (
            <button disabled={!canUndo} onClick={() => void undoMove()}>
              Undo {undo.remaining}
            </button>
          ) : null}
          {isActiveRun ? (
            <>
              <button
                disabled={!gameId}
                onClick={() => {
                  if (!gameId) return;
                  window.open(`/api/games/${gameId}/export`, "_blank");
                }}
              >
                Export JSON
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  replayInputRef.current?.click();
                }}
              >
                Replay JSON
              </button>
            </>
          ) : UI_POLICY.showOptionsButton ? (
            <details className="options-panel">
              <summary>Options</summary>
              <div className="options-grid">
                {UI_POLICY.controls.difficulty ? (
                  <label className="difficulty-select-wrap">
                    <span className="difficulty-label">Difficulty</span>
                    <select
                      aria-label="Wildcard spawn mode"
                      className={`difficulty-select mode-${spawnMode}`}
                      value={spawnMode}
                      onChange={(event) => setSpawnMode(event.target.value as SpawnMode)}
                      disabled={busy || difficultyLocked}
                    >
                      <option value="normal">{SPAWN_MODES.normal.label}</option>
                      <option value="ltfg">{SPAWN_MODES.ltfg.label}</option>
                      <option value="death">{SPAWN_MODES.death.label}</option>
                    </select>
                  </label>
                ) : null}
                {UI_POLICY.controls.color ? (
                  <label className="color-mode-wrap">
                    <span className="difficulty-label">Color</span>
                    <select
                      aria-label="Color mode"
                      className="color-mode-select"
                      value={colorMode}
                      onChange={(event) => setColorMode(event.target.value as ColorMode)}
                    >
                      <option value="default">Default</option>
                      <option value="cb-protanopia">CB Protanopia</option>
                      <option value="cb-deuteranopia">CB Deuteranopia</option>
                      <option value="cb-tritanopia">CB Tritanopia</option>
                    </select>
                  </label>
                ) : null}
                {UI_POLICY.controls.color ? (
                  <label className="theme-mode-wrap">
                    <span className="difficulty-label">Theme</span>
                    <select
                      aria-label="Theme mode"
                      className="theme-mode-select"
                      value={themeMode}
                      onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
                    >
                      {Object.entries(THEMES).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {UI_POLICY.controls.mode ? (
                  <label className="mode-select-wrap">
                    <span className="difficulty-label">Mode</span>
                    <select
                      aria-label="Game mode"
                      className="game-mode-select"
                      value={gameMode}
                      onChange={(event) => setGameMode(event.target.value as GameMode)}
                      disabled={busy || difficultyLocked}
                    >
                      <option value="classic">{GAME_MODES.classic.label}</option>
                      <option value="bitstorm">{GAME_MODES.bitstorm.label}</option>
                    </select>
                  </label>
                ) : null}
                {UI_POLICY.controls.import ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => {
                        importInputRef.current?.click();
                      }}
                    >
                      Import JSON
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        replayInputRef.current?.click();
                      }}
                    >
                      Replay JSON
                    </button>
                  </>
                ) : null}
                {UI_POLICY.controls.export ? (
                  <button
                    disabled={!gameId}
                    onClick={() => {
                      if (!gameId) return;
                      window.open(`/api/games/${gameId}/export`, "_blank");
                    }}
                  >
                    Export JSON
                  </button>
                ) : null}
              </div>
            </details>
          ) : null}
          <input
            ref={importInputRef}
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
        <details className="game-hint">
          <summary>How to play: Swipe on mobile or use arrow keys/WASD. Keep your strongest chain organized.</summary>
          <div className="game-hint-body">
            <p>Basic moves: all tiles slide in one direction per turn.</p>
            <p>`0` tiles annihilate when they collide with any tile. `0+0` also vanishes.</p>
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
              window.open(socialUrls.x, "_blank", "noopener,noreferrer");
            }}
          >
            X
          </button>
          <button
            type="button"
            onClick={() => {
              window.open(socialUrls.linkedin, "_blank", "noopener,noreferrer");
            }}
          >
            LinkedIn
          </button>
          <button type="button" onClick={() => void copyShare()}>
            Copy
          </button>
          {shareMessage ? <span className="share-status">{shareMessage}</span> : null}
        </div>
        <p className="build-version" aria-label="app version">
          v{APP_VERSION} ({APP_COMMIT})
        </p>
      </div>
    </main>
  );
}
