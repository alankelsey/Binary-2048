#!/usr/bin/env node

const BASE = process.env.BASE ?? "http://localhost:3000";
const SEEDS = Number(process.env.SEEDS ?? "3");
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "250");
const SEED_START = Number(process.env.SEED_START ?? "100");

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

async function main() {
  const result = await requestJson("/api/bots/tournament", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      seedStart: SEED_START,
      seedCount: SEEDS,
      maxMoves: MAX_MOVES
    })
  });
  console.log(JSON.stringify({ base: BASE, ...result }, null, 2));
}

main().catch((error) => {
  console.error(`[bot:tourney] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
