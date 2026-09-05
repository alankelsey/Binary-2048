#!/usr/bin/env node

import { upsertBenchmarkRecord } from "./hf-benchmark-ledger.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "25");
const SEEDS = (process.env.ROLLOUT_TRACE_SEEDS ?? "100,101,102,103,104")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter(Number.isInteger);
const RUN_LEDGER = process.env.HF_RUN_LEDGER ?? "docs/hf-benchmark-runs.json";
const EXPERIMENT_ID = process.env.HF_EXPERIMENT_ID ?? "trace-regeneration-2026-09";
const EXPERIMENT_PHASE = process.env.HF_EXPERIMENT_PHASE ?? "rollout-baseline";

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${url} failed: ${payload?.error ?? `HTTP ${response.status}`}`);
  return payload;
}

function percentile95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null;
}

async function main() {
  if (SEEDS.length === 0) throw new Error("ROLLOUT_TRACE_SEEDS must contain at least one integer seed");
  if (!Number.isInteger(MAX_MOVES) || MAX_MOVES < 1) throw new Error("MAX_MOVES must be a positive integer");

  const tournament = await requestJson(`${BASE}/api/bots/tournament`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seeds: SEEDS, maxMoves: MAX_MOVES, bots: ["rollout"], includeTraces: true })
  });
  const summaries = [];
  for (const run of tournament.runs ?? []) {
    const trace = run.trace;
    if (trace?.complete !== true || trace.decisions?.length !== run.moves) {
      throw new Error(`seed ${run.seed}: incomplete rollout trace`);
    }
    const latencies = trace.decisions.map((step) => Number(step?.decision?.latencyMs ?? 0));
    const totalLatency = latencies.reduce((sum, value) => sum + value, 0);
    const averageLatency = latencies.length ? Math.round(totalLatency / latencies.length) : null;
    await upsertBenchmarkRecord(RUN_LEDGER, {
      runId: `rollout:${EXPERIMENT_ID}:${run.seed}`,
      recordedAtISO: new Date().toISOString(),
      experimentId: EXPERIMENT_ID,
      phase: EXPERIMENT_PHASE,
      track: "deterministic-seeded-game",
      seed: {
        value: run.seed,
        generator: "binary2048 counter-based seed+rngStep PRNG",
        note: "The same seed and move sequence reproduce initial tiles and later spawns. The rollout policy uses mulberry32(seed XOR hashBotId) for deterministic simulations."
      },
      rulesetId: tournament.rulesetId,
      model: {
        id: "rollout",
        provider: "rollout",
        type: "monte-carlo-rollout",
        thinkingEnabled: false,
        parameters: {
          rolloutsPerAction: 6,
          rolloutDepth: 10,
          policyRng: "mulberry32(seed XOR hashBotId)",
          engineCandidateBoards: true
        }
      },
      metrics: {
        moves: run.moves,
        score: run.score,
        maxTile: run.maxTile,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        fallbackCount: 0,
        averageModelLatencyMs: averageLatency,
        p95ModelLatencyMs: percentile95(latencies),
        totalModelLatencyMs: Math.round(totalLatency * 1000) / 1000
      },
      estimatedCostUsd: {
        listedTokenRates: 0,
        conservativeObservedRequestRate: 0,
        inputUsdPerMillion: 0,
        outputUsdPerMillion: 0,
        observedUsdPerRequest: 0
      },
      trace,
      rollout: { bot: "rollout", score: run.score, moves: run.moves, maxTile: run.maxTile }
    });
    summaries.push({ seed: run.seed, moves: run.moves, score: run.score, maxTile: run.maxTile, averageLatencyMs: averageLatency });
  }
  console.log(JSON.stringify({ ok: true, ledger: RUN_LEDGER, runs: summaries }, null, 2));
}

main().catch((error) => {
  console.error(`[rollout:trace] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
