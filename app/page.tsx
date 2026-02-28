"use client";

import { useEffect, useState } from "react";

type Tile = { t: "n"; v: number } | { t: "z" } | { t: "w"; m: number };
type Cell = Tile | null;
type Dir = "up" | "down" | "left" | "right";

type GameState = {
  id: string;
  width: number;
  height: number;
  score: number;
  won: boolean;
  over: boolean;
  grid: Cell[][];
};

export default function Home() {
  const [gameId, setGameId] = useState<string>("");
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);

  async function newGame() {
    setBusy(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await res.json();
      setGameId(json.id);
      setState(json.current);
    } finally {
      setBusy(false);
    }
  }

  async function move(dir: Dir) {
    if (!gameId || !state || state.over) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/games/${gameId}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir })
      });
      const json = await res.json();
      setState(json.current);
    } finally {
      setBusy(false);
    }
  }

  function label(cell: Cell): string {
    if (!cell) return "";
    if (cell.t === "z") return "0";
    if (cell.t === "w") return `W${cell.m}`;
    return String(cell.v);
  }

  useEffect(() => {
    void newGame();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowUp") void move("up");
      if (event.key === "ArrowDown") void move("down");
      if (event.key === "ArrowLeft") void move("left");
      if (event.key === "ArrowRight") void move("right");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main>
      <h1>Binary 2048</h1>
      <p>Arrow keys also work. Bonus tiles: zero annihilator + wildcard multipliers.</p>
      <div className="card">
        <div className="meta">
          <span>Game: {gameId || "-"}</span>
          <span>Score: {state?.score ?? 0}</span>
          <span>{state?.won ? "Won" : state?.over ? "Game Over" : "Active"}</span>
        </div>
        <div className="board" style={{ gridTemplateColumns: `repeat(${state?.width ?? 4}, minmax(0, 1fr))` }}>
          {state?.grid.flat().map((cell, index) => (
            <div key={index} className="cell">
              {label(cell)}
            </div>
          ))}
        </div>
        <div className="controls">
          <button disabled={busy} onClick={() => void move("up")}>
            Up
          </button>
          <button disabled={busy} onClick={() => void move("left")}>
            Left
          </button>
          <button disabled={busy} onClick={() => void move("down")}>
            Down
          </button>
          <button disabled={busy} onClick={() => void move("right")}>
            Right
          </button>
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
      </div>
    </main>
  );
}
