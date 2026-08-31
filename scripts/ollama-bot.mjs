#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { buildMovePrompt, parseOllamaAction } from "./ollama-bot-lib.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "25");
const CHECK_ONLY = process.env.OLLAMA_CHECK_ONLY === "1";

async function requestJson(base, path, init = {}) {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${path}: ${text.slice(0, 240)}`);
  }
  if (!response.ok) {
    throw new Error(`${path} failed: ${payload?.error ?? `HTTP ${response.status}`}`);
  }
  return payload;
}

async function pickAction(encoded) {
  const legalActions = encoded?.legalActions;
  if (!Array.isArray(legalActions) || legalActions.length === 0) return null;
  const started = performance.now();
  const response = await requestJson(OLLAMA_BASE, "/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      think: false,
      keep_alive: "10m",
      format: {
        type: "object",
        properties: { action: { type: "string", enum: legalActions } },
        required: ["action"],
        additionalProperties: false
      },
      options: { temperature: 0, num_predict: 16 },
      messages: [
        { role: "system", content: "You are a deterministic Binary 2048 move-selection policy." },
        { role: "user", content: buildMovePrompt(encoded.encodedState, legalActions) }
      ]
    })
  });
  const selected = parseOllamaAction(response?.message?.content ?? "", legalActions);
  return selected ? { ...selected, latencyMs: Math.round(performance.now() - started) } : null;
}

async function check() {
  const version = await requestJson(OLLAMA_BASE, "/api/version");
  const tags = await requestJson(OLLAMA_BASE, "/api/tags");
  const installed = (tags?.models ?? []).some((entry) => entry?.name === OLLAMA_MODEL);
  if (!installed) throw new Error(`Model ${OLLAMA_MODEL} is not installed`);
  console.log(JSON.stringify({ ok: true, version: version.version, model: OLLAMA_MODEL }, null, 2));
}

async function play() {
  const created = await requestJson(BASE, "/api/games", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  const id = created?.id;
  if (!id) throw new Error("Create game response missing id");

  let moves = 0;
  let fallbackMoves = 0;
  const latencies = [];
  let done = false;
  while (!done && moves < MAX_MOVES) {
    const encoded = await requestJson(BASE, `/api/games/${id}/encoded`);
    const selected = await pickAction(encoded);
    if (!selected) break;
    if (selected.fallback) fallbackMoves += 1;
    latencies.push(selected.latencyMs);
    const moved = await requestJson(BASE, `/api/games/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: selected.action, expectStateHash: encoded.stateHash })
    });
    moves += 1;
    done = Boolean(moved?.done);
    console.log(`move=${moves} action=${selected.action} latencyMs=${selected.latencyMs} fallback=${selected.fallback}`);
  }

  const final = await requestJson(BASE, `/api/games/${id}`);
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(JSON.stringify({
    id,
    model: OLLAMA_MODEL,
    moves,
    fallbackMoves,
    score: final?.current?.score ?? 0,
    maxTile: Math.max(0, ...((final?.current?.grid ?? []).flat().map((cell) => cell?.t === "n" ? cell.v : 0))),
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
    p95LatencyMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null
  }, null, 2));
}

(CHECK_ONLY ? check() : play()).catch((error) => {
  console.error(`[ollama:bot] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

