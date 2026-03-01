"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";

type Tile = { t: "n"; v: number } | { t: "z" } | { t: "w"; m: number };
type Cell = Tile | null;
type Dir = "up" | "down" | "left" | "right";
type CellEffect = "merge-number" | "merge-wild" | "zero-bust";

type GameState = {
  id: string;
  width: number;
  height: number;
  score: number;
  won: boolean;
  over: boolean;
  grid: Cell[][];
};

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
  const highScoreKey = "binary2048.highScore";
  const [gameId, setGameId] = useState<string>("");
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [highScore, setHighScore] = useState(0);
  const [cellEffects, setCellEffects] = useState<Record<string, CellEffect>>({});
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const effectTimerRef = useRef<number | null>(null);

  async function newGame() {
    setBusy(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.current || !json?.id) {
        const message = (json && typeof json.error === "string" ? json.error : "Failed to create game");
        throw new Error(message);
      }
      setGameId(json.id);
      setState(json.current);
      setCellEffects({});
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create game");
    } finally {
      setBusy(false);
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
    const zeroCollided = nextZeroCount < prevZeroCount;

    for (let r = 0; r < next.height; r++) {
      for (let c = 0; c < next.width; c++) {
        const key = `${r}-${c}`;
        const before = prev.grid[r]?.[c] ?? null;
        const after = next.grid[r]?.[c] ?? null;
        if (zeroCollided && before?.t === "z" && after?.t !== "z") {
          effects[key] = "zero-bust";
          continue;
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
    }, 280);
  }

  function label(cell: Cell): string {
    if (!cell) return "";
    if (cell.t === "z") return "0";
    if (cell.t === "w") return `W${cell.m}`;
    return String(cell.v);
  }

  function cellTypeClass(cell: Cell): string {
    if (!cell) return "cell-empty";
    if (cell.t === "w") return "tile-wild";
    if (cell.t === "z") return "tile-zero";
    return "tile-number";
  }

  useEffect(() => {
    void newGame();
  }, []);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(highScoreKey);
    const parsed = Number(raw ?? "0");
    if (!Number.isNaN(parsed) && parsed > 0) setHighScore(parsed);
  }, []);

  useEffect(() => {
    const score = state?.score ?? 0;
    if (score <= highScore) return;
    setHighScore(score);
    window.sessionStorage.setItem(highScoreKey, String(score));
  }, [state?.score, highScore]);

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

  return (
    <main>
      <header className="brand">
        <Binary2048Logo />
        <div>
          <h1>Binary 2048</h1>
          <p className="brand-subtitle">Merge bits. Control chaos. Reach 2048.</p>
        </div>
      </header>
      <p>Arrow keys also work. Bonus tiles: zero annihilator + wildcard multipliers.</p>
      <div className="card">
        <div className="meta">
          <span>Game: {gameId || "-"}</span>
          <span className="score-pill">Score: {state?.score ?? 0}</span>
          <span>High: {highScore}</span>
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
                  >
                    {cell?.t === "w" ? (
                      <span className="wild-icon-wrap">
                        <span className="wild-icon" aria-hidden="true">
                          ✦
                        </span>
                        <span>{cell.m}</span>
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
          <button disabled={busy} onClick={() => void newGame()}>
            New Game
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
        <details className="game-hint">
          <summary>How to play: Swipe on mobile or use arrow keys. Keep your strongest chain organized.</summary>
          <div className="game-hint-body">
            <p>Basic moves: all tiles slide in one direction per turn.</p>
            <p>`0` tiles annihilate when they collide with any tile. `0+0` also vanishes.</p>
            <p>Wildcards (`W2`, `W4`, ...) multiply number tiles and can merge with matching wildcards.</p>
            <p>Game ends when no empty cells and no valid merges remain.</p>
          </div>
        </details>
        <p className="swipe-hint">Tip: keep your highest value anchored to one side and avoid breaking the chain.</p>
      </div>
    </main>
  );
}
