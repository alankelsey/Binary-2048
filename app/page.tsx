"use client";

import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";

type Tile = { t: "n"; v: number } | { t: "z" } | { t: "w"; m: number };
type Cell = Tile | null;
type Dir = "up" | "down" | "left" | "right";
type CellEffect = "merge-number" | "merge-wild" | "zero-bust";
type SpawnMode = "normal" | "ltfg" | "death";

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
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "dev";

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
  const highScoreKey = "binary2048.highScore";
  const [gameId, setGameId] = useState<string>("");
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [highScore, setHighScore] = useState(0);
  const [spawnMode, setSpawnMode] = useState<SpawnMode>("normal");
  const [cellEffects, setCellEffects] = useState<Record<string, CellEffect>>({});
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const effectTimerRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  async function newGame() {
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
    if (!gameId || !state || state.over) return;
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
      const events = Array.isArray(json?.lastStep?.events) ? json.lastStep.events : [];
      const hasMergeEvent = events.some((event: { type?: string }) => event?.type === "merge");
      setState(next);
      startCellEffects(computeCellEffects(previous, next, hasMergeEvent));
      if (next.over || next.won) {
        window.localStorage.removeItem(gameIdKey);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to apply move");
    } finally {
      setBusy(false);
    }
  }

  function computeCellEffects(prev: GameState, next: GameState, hasMergeEvent: boolean): Record<string, CellEffect> {
    const effects: Record<string, CellEffect> = {};
    const prevZeroCount = prev.grid.flat().filter((cell) => cell?.t === "z").length;
    const nextZeroCount = next.grid.flat().filter((cell) => cell?.t === "z").length;
    const prevWildCount = prev.grid.flat().filter((cell) => cell?.t === "w").length;
    const nextWildCount = next.grid.flat().filter((cell) => cell?.t === "w").length;
    const zeroCollisionCount = Math.max(0, prevZeroCount - nextZeroCount);
    const wildCollisionCount = Math.max(0, prevWildCount - nextWildCount);
    const changedNumberCells: string[] = [];
    const changedOccupiedCells: string[] = [];

    const tileChanged = (before: Cell, after: Cell) => {
      if (!before && !after) return false;
      if (!before || !after) return true;
      if (before.t !== after.t) return true;
      if (before.t === "n" && after.t === "n") return before.v !== after.v;
      if (before.t === "w" && after.t === "w") return before.m !== after.m;
      return false;
    };

    for (let r = 0; r < next.height; r++) {
      for (let c = 0; c < next.width; c++) {
        const key = `${r}-${c}`;
        const before = prev.grid[r]?.[c] ?? null;
        const after = next.grid[r]?.[c] ?? null;

        if (after && tileChanged(before, after)) {
          changedOccupiedCells.push(key);
          if (after.t === "n") changedNumberCells.push(key);
        }

        if (!hasMergeEvent || !after) continue;
        if (after.t === "w") {
          if (before?.t !== "w" || before.m !== after.m) effects[key] = "merge-wild";
          continue;
        }
        if (after.t === "n") {
          if (before?.t !== "n" || before.v !== after.v) effects[key] = "merge-number";
        }
      }
    }

    // Wildcard collisions should feel like a boost: highlight impacted number destinations in green.
    if (wildCollisionCount > 0) {
      let assigned = 0;
      for (const key of changedNumberCells) {
        effects[key] = "merge-wild";
        assigned += 1;
        if (assigned >= wildCollisionCount) break;
      }
    }

    // Zero collisions should animate where impact is seen, not where the zero started.
    if (zeroCollisionCount > 0) {
      let assigned = 0;
      for (const key of changedOccupiedCells) {
        effects[key] = "zero-bust";
        assigned += 1;
        if (assigned >= zeroCollisionCount) break;
      }
    }
    return effects;
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
    const hue = Math.round(210 - 206 * t);
    const lightTop = Math.round(30 + 22 * t);
    const lightBottom = Math.round(22 + 15 * t);
    return {
      color: "#f8fbff",
      background: `linear-gradient(180deg, hsl(${hue} 72% ${lightTop}%), hsl(${hue} 74% ${lightBottom}%))`,
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
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowUp") void move("up");
      if (event.key === "ArrowDown") void move("down");
      if (event.key === "ArrowLeft") void move("left");
      if (event.key === "ArrowRight") void move("right");
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
    if (!touchStartRef.current || busy || !state || state.over) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const minSwipe = 24;

    if (absX < minSwipe && absY < minSwipe) return;
    if (absX > absY) {
      void move(dx > 0 ? "right" : "left");
    } else {
      void move(dy > 0 ? "down" : "up");
    }
  }

  const wildcardRate = state?.config?.spawn?.pWildcard;
  const activeMode = typeof wildcardRate === "number" ? modeFromWildcardRate(wildcardRate) : spawnMode;
  const difficultyLocked = Boolean(state && !state.over && !state.won && (state.turn ?? 0) > 0);

  return (
    <main>
      <header className="brand">
        <Binary2048Logo />
        <div>
          <h1>Binary 2048</h1>
          <p className="brand-subtitle">Merge bits. Control chaos. Reach 2048.</p>
        </div>
      </header>
      <p>Arrow keys combine tiles. Bonus tiles: zero annihilator + wildcard multipliers.</p>
      <div className="card">
        <div className="meta">
          <span>Game: {gameId || "-"}</span>
          <span className="score-pill">Score: {state?.score ?? 0}</span>
          <span>Moves: {state?.turn ?? 0}</span>
          <span>High: {highScore}</span>
          <span>Mode: {SPAWN_MODES[activeMode].label}</span>
          <span>{state?.won ? "Won" : state?.over ? "Game Over" : "Active"}</span>
        </div>
        {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
        <div className={`board-shell ${state?.over ? "game-over" : ""}`}>
          <div
            className="board"
            style={{ gridTemplateColumns: `repeat(${state?.width ?? 4}, minmax(0, 1fr))` }}
            onTouchStart={onBoardTouchStart}
            onTouchEnd={onBoardTouchEnd}
          >
            {state?.grid.map((row, r) =>
              row.map((cell, c) => {
                const effect = cellEffects[`${r}-${c}`];
                const effectClass = effect ? `fx-${effect}` : "";
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`cell ${cell ? "filled" : "empty"} ${cellTypeClass(cell)} ${effectClass}`}
                    style={numberTileStyle(cell)}
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
          {state?.over ? (
            <div className="gameover-overlay" role="status" aria-live="polite">
              <div className="gameover-title">GAME OVER</div>
              <div className="gameover-stats">
                <span>Score: {state.score}</span>
                <span>High: {Math.max(highScore, state.score)}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="actions">
          <div className="primary-controls">
            <button disabled={busy} onClick={() => void newGame()}>
              New Game
            </button>
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
          </div>
          <div className="secondary-controls">
            <button
              disabled={busy}
              onClick={() => {
                importInputRef.current?.click();
              }}
            >
              Import JSON
            </button>
            <button
              disabled={!gameId}
              onClick={() => {
                if (!gameId) return;
                window.open(`/api/games/${gameId}/export`, "_blank");
              }}
            >
              Export JSON
            </button>
          </div>
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
        </div>
        <details className="game-hint">
          <summary>How to play: Swipe on mobile or use arrow keys. Keep your strongest chain organized.</summary>
          <div className="game-hint-body">
            <p>Basic moves: all tiles slide in one direction per turn.</p>
            <p>`0` tiles annihilate when they collide with any tile. `0+0` also vanishes.</p>
            <p>Wildcard tiles (`✦`) double any number tile they collide with, then disappear.</p>
            <p>Game ends when no empty cells and no valid merges remain.</p>
            <p>Tip: keep your highest value anchored to one side and avoid breaking the chain.</p>
          </div>
        </details>
        <p className="build-version" aria-label="app version">
          v{APP_VERSION} ({APP_COMMIT})
        </p>
      </div>
    </main>
  );
}
