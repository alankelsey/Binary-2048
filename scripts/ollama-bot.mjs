#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { buildMovePrompt, parseOllamaAction } from "./ollama-bot-lib.mjs";
import { upsertBenchmarkRecord } from "./hf-benchmark-ledger.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "25");
const SEED = Number(process.env.SEED ?? "100");
const CHECK_ONLY = process.env.OLLAMA_CHECK_ONLY === "1";
const RUN_LEDGER = process.env.MODEL_RUN_LEDGER ?? "docs/hf-benchmark-runs.json";
const EXPERIMENT_ID = process.env.MODEL_EXPERIMENT_ID ?? "manual-local-benchmark";
const EXPERIMENT_PHASE = process.env.MODEL_EXPERIMENT_PHASE ?? "unassigned";
const COMPARE_ROLLOUT = process.env.MODEL_COMPARE_ROLLOUT !== "0";

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
  const startedAtISO = new Date().toISOString();
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
        { role: "user", content: buildMovePrompt(encoded.encodedState, legalActions, encoded.candidates) }
      ]
    })
  });
  const selected = parseOllamaAction(response?.message?.content ?? "", legalActions);
  return selected ? {
    ...selected,
    latencyMs: Math.round(performance.now() - started),
    promptTokens: Number(response?.prompt_eval_count ?? 0),
    outputTokens: Number(response?.eval_count ?? 0),
    startedAtISO,
    finishedAtISO: new Date().toISOString()
  } : null;
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
    body: JSON.stringify({ config: { seed: SEED } })
  });
  const id = created?.id;
  if (!id) throw new Error("Create game response missing id");

  let moves = 0;
  let fallbackMoves = 0;
  const latencies = [];
  let promptTokens = 0;
  let outputTokens = 0;
  const decisions = [];
  let done = false;
  while (!done && moves < MAX_MOVES) {
    const encoded = await requestJson(BASE, `/api/games/${id}/encoded`);
    const selected = await pickAction(encoded);
    if (!selected) break;
    if (selected.fallback) fallbackMoves += 1;
    latencies.push(selected.latencyMs);
    promptTokens += selected.promptTokens;
    outputTokens += selected.outputTokens;
    const moved = await requestJson(BASE, `/api/games/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: selected.action, expectStateHash: encoded.stateHash })
    });
    const selectedCandidate = encoded.candidates?.find((candidate) => candidate?.action === selected.action) ?? null;
    decisions.push({
      turn: moves,
      before: {
        stateHash: encoded.stateHash,
        encodedState: encoded.encodedState,
        encodedFlat: encoded.encodedFlat,
        legalActions: encoded.legalActions,
        actionMask: encoded.actionMask,
        candidates: encoded.candidates,
        engine: encoded.meta
      },
      decision: {
        action: selected.action,
        fallback: selected.fallback,
        startedAtISO: selected.startedAtISO,
        finishedAtISO: selected.finishedAtISO,
        latencyMs: selected.latencyMs,
        inputTokens: selected.promptTokens,
        outputTokens: selected.outputTokens,
        reasoningTokens: 0
      },
      after: {
        stateHash: moved.stateHash,
        encodedState: selectedCandidate?.encodedState ?? null,
        score: moved.current?.score ?? null,
        turn: moved.current?.turn ?? moves + 1,
        reward: moved.reward,
        changed: moved.changed,
        done: moved.done,
        spawned: moved.spawned
      }
    });
    moves += 1;
    done = Boolean(moved?.done);
    console.log(`move=${moves} action=${selected.action} latencyMs=${selected.latencyMs} promptTokens=${selected.promptTokens} outputTokens=${selected.outputTokens} fallback=${selected.fallback}`);
  }

  const final = await requestJson(BASE, `/api/games/${id}`);
  const sorted = [...latencies].sort((a, b) => a - b);
  let rollout = null;
  if (COMPARE_ROLLOUT) {
    try {
      const comparison = await requestJson(BASE, "/api/bots/tournament", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seeds: [SEED], maxMoves: MAX_MOVES, bots: ["rollout"] })
      });
      const run = comparison?.runs?.find((entry) => entry?.bot === "rollout" && entry?.seed === SEED);
      if (run) rollout = { bot: "rollout", score: run.score, moves: run.moves, maxTile: run.maxTile };
    } catch (error) {
      console.warn(`[ollama:bot] rollout comparison unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const result = {
    id,
    model: OLLAMA_MODEL,
    seed: SEED,
    moves,
    fallbackMoves,
    promptTokens,
    outputTokens,
    totalTokens: promptTokens + outputTokens,
    score: final?.current?.score ?? 0,
    maxTile: Math.max(0, ...((final?.current?.grid ?? []).flat().map((cell) => cell?.t === "n" ? cell.v : 0))),
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
    p95LatencyMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null
  };
  const ledgerRecord = await upsertBenchmarkRecord(RUN_LEDGER, {
    runId: id,
    recordedAtISO: new Date().toISOString(),
    experimentId: EXPERIMENT_ID,
    phase: EXPERIMENT_PHASE,
    track: "deterministic-seeded-game",
    seed: {
      value: SEED,
      generator: "binary2048 counter-based seed+rngStep PRNG",
      note: "The same seed and move sequence reproduce initial tiles and later spawns."
    },
    rulesetId: "binary2048-v1",
    model: {
      id: OLLAMA_MODEL,
      provider: "ollama",
      type: "non-thinking",
      thinkingEnabled: false,
      parameters: { temperature: 0, maxOutputTokens: 16, structuredOutput: "json_schema", engineCandidateBoards: true }
    },
    metrics: {
      moves,
      score: result.score,
      maxTile: result.maxTile,
      inputTokens: promptTokens,
      outputTokens,
      reasoningTokens: 0,
      fallbackCount: fallbackMoves,
      averageModelLatencyMs: result.avgLatencyMs,
      p95ModelLatencyMs: result.p95LatencyMs,
      totalModelLatencyMs: latencies.reduce((sum, value) => sum + value, 0)
    },
    estimatedCostUsd: {
      listedTokenRates: 0,
      conservativeObservedRequestRate: 0,
      inputUsdPerMillion: 0,
      outputUsdPerMillion: 0,
      observedUsdPerRequest: 0
    },
    trace: { version: 1, complete: decisions.length === moves, actions: decisions.map((entry) => entry.decision.action), decisions },
    rollout
  });
  console.log(JSON.stringify({ ...result, ledger: RUN_LEDGER, ledgerSchemaVersion: ledgerRecord.schemaVersion, rollout }, null, 2));
}

(CHECK_ONLY ? check() : play()).catch((error) => {
  console.error(`[ollama:bot] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
