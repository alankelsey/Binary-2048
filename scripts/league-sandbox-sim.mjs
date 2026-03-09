#!/usr/bin/env node

const BASE = process.env.BASE ?? "http://localhost:3000";
const TOKEN = process.env.TOKEN ?? "";
const LEAGUE_KEY = process.env.LEAGUE_KEY ?? "";
const PLAYERS = Number(process.env.PLAYERS ?? "8");
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "120");
const MOVES = ["up", "right", "down", "left"];

async function requestJson(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 240)}`);
  }
  if (!res.ok) {
    const message = typeof json?.error === "string" ? json.error : `HTTP ${res.status}`;
    throw new Error(`${path} failed: ${message}`);
  }
  return json;
}

async function playOne(index) {
  const created = await requestJson("/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  const gameId = created.id;
  if (!gameId) throw new Error("missing game id");
  for (let i = 0; i < MAX_MOVES; i += 1) {
    const dir = MOVES[(index + i) % MOVES.length];
    const moved = await requestJson(`/api/games/${gameId}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dir })
    });
    if (moved?.state?.over || moved?.state?.won) break;
  }
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${TOKEN}`
  };
  if (LEAGUE_KEY) headers["x-league-client-key"] = LEAGUE_KEY;
  const submitted = await requestJson("/api/leaderboard/submit", {
    method: "POST",
    headers,
    body: JSON.stringify({
      gameId,
      isSandbox: true,
      seasonMode: "preview",
      isPractice: true
    })
  });
  return {
    gameId,
    score: submitted?.entry?.score ?? 0,
    namespace: submitted?.storedNamespace ?? "unknown"
  };
}

async function main() {
  if (!TOKEN) {
    throw new Error("TOKEN is required (auth bridge token)");
  }
  const runs = [];
  for (let i = 0; i < PLAYERS; i += 1) {
    runs.push(await playOne(i));
  }
  runs.sort((a, b) => b.score - a.score);
  const top = runs[0] ?? null;
  console.log(
    JSON.stringify(
      {
        base: BASE,
        players: PLAYERS,
        mode: "sandbox-preview",
        top,
        leaderboard: runs.slice(0, 8)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[league:sandbox:sim] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

