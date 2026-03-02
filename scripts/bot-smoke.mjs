#!/usr/bin/env node

const BASE = process.env.BASE ?? "http://localhost:3000";
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "400");
const ACTION_PRIORITY = ["U", "L", "R", "D"];

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

function pickAction(legalActions) {
  if (!Array.isArray(legalActions) || legalActions.length === 0) return null;
  for (const preferred of ACTION_PRIORITY) {
    if (legalActions.includes(preferred)) return preferred;
  }
  return legalActions[0] ?? null;
}

async function main() {
  const created = await requestJson("/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  const id = created?.id;
  if (!id) throw new Error("Create game response missing id");

  let moves = 0;
  let done = false;
  let score = created?.current?.score ?? 0;

  while (!done && moves < MAX_MOVES) {
    const encoded = await requestJson(`/api/games/${id}/encoded`);
    const action = pickAction(encoded?.legalActions);
    if (!action) break;

    const move = await requestJson(`/api/games/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    });
    moves += 1;
    done = Boolean(move?.done);
    score = Number(move?.current?.score ?? score);
  }

  const state = await requestJson(`/api/games/${id}`);
  const summary = {
    id,
    moves,
    score,
    turn: state?.current?.turn ?? null,
    over: Boolean(state?.current?.over),
    won: Boolean(state?.current?.won)
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(`[bot:smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
