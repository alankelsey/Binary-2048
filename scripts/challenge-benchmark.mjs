#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { correctFallbackObjectives, evaluateChallengeTrace, renderChallengeReport, summarizeChallengeRecords } from "./challenge-benchmark-lib.mjs";
import { modelProvider, upsertBenchmarkRecord } from "./hf-benchmark-ledger.mjs";
import { buildMovePrompt, parseOllamaAction } from "./ollama-bot-lib.mjs";

function localEnvValue(name) {
  try {
    const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  } catch {
    return undefined;
  }
}

const BASE = process.env.BASE ?? "http://localhost:3000";
const ADAPTER = process.env.CHALLENGE_ADAPTER ?? "rollout";
const CORPUS_PATH = process.env.CHALLENGE_CORPUS ?? "data/model-benchmark/challenge-corpus.v1.json";
const LEDGER_PATH = process.env.CHALLENGE_RUN_LEDGER ?? "docs/challenge-benchmark-runs.json";
const REPORT_PATH = process.env.CHALLENGE_REPORT ?? "docs/challenge-benchmark-latest.md";
const SCENARIO_FILTER = new Set((process.env.CHALLENGE_SCENARIOS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const OLLAMA_BASE = process.env.OLLAMA_BASE ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const HF_BASE = process.env.HF_BASE ?? "https://router.huggingface.co/v1";
const HF_MODEL = process.env.HF_MODEL ?? "Qwen/Qwen3.5-397B-A17B:deepinfra";
const HF_TOKEN = process.env.HF_TOKEN ?? localEnvValue("HF_TOKEN");
const HF_ENABLE_THINKING = process.env.HF_ENABLE_THINKING === "1";
const HF_MAX_OUTPUT_TOKENS = Number(process.env.HF_MAX_OUTPUT_TOKENS ?? (HF_ENABLE_THINKING ? "512" : "16"));
const HF_INPUT_USD_PER_MILLION = Number(process.env.HF_INPUT_USD_PER_MILLION ?? "0.45");
const HF_OUTPUT_USD_PER_MILLION = Number(process.env.HF_OUTPUT_USD_PER_MILLION ?? "3.00");
const HF_OBSERVED_USD_PER_REQUEST = Number(process.env.HF_OBSERVED_USD_PER_REQUEST ?? String(0.25 / 35));
const HOSTED_COST_CAP_USD = Number(process.env.CHALLENGE_MAX_ESTIMATED_COST_USD ?? "1.00");

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 240)}`);
  }
  if (!response.ok) throw new Error(`${url} failed: ${payload?.error?.message ?? payload?.error ?? `HTTP ${response.status}`}`);
  return payload;
}

function latencyMetrics(trace) {
  const values = trace.decisions.map((step) => Number(step.decision.latencyMs ?? 0));
  const sorted = [...values].sort((a, b) => a - b);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    average: values.length ? Math.round(total / values.length) : null,
    p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null,
    total
  };
}

function maxTile(grid) {
  return Math.max(0, ...(grid ?? []).flat().map((cell) => cell?.t === "n" ? cell.v : 0));
}

async function pickOllama(encoded) {
  const started = performance.now();
  const response = await requestJson(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      think: false,
      keep_alive: "10m",
      format: { type: "object", properties: { action: { type: "string", enum: encoded.legalActions } }, required: ["action"], additionalProperties: false },
      options: { temperature: 0, num_predict: 16 },
      messages: [
        { role: "system", content: "You are a deterministic Binary 2048 move-selection policy." },
        { role: "user", content: buildMovePrompt(encoded.encodedState, encoded.legalActions, encoded.candidates) }
      ]
    })
  });
  const selected = parseOllamaAction(response?.message?.content ?? "", encoded.legalActions);
  return selected && { ...selected, latencyMs: Math.round(performance.now() - started), inputTokens: Number(response?.prompt_eval_count ?? 0), outputTokens: Number(response?.eval_count ?? 0), reasoningTokens: 0 };
}

async function pickHuggingFace(encoded) {
  const started = performance.now();
  const response = await requestJson(`${HF_BASE}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${HF_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: HF_MODEL,
      temperature: 0,
      max_tokens: HF_MAX_OUTPUT_TOKENS,
      ...(HF_MODEL.startsWith("Qwen/") ? { chat_template_kwargs: { enable_thinking: HF_ENABLE_THINKING } } : {}),
      response_format: { type: "json_schema", json_schema: { name: "binary2048_action", strict: true, schema: { type: "object", properties: { action: { type: "string", enum: encoded.legalActions } }, required: ["action"], additionalProperties: false } } },
      messages: [
        { role: "system", content: HF_ENABLE_THINKING ? "You are a Binary 2048 policy. Analyze the engine candidates, then return only the required JSON action." : "You are a deterministic Binary 2048 move-selection policy. Do not think aloud." },
        { role: "user", content: buildMovePrompt(encoded.encodedState, encoded.legalActions, encoded.candidates) }
      ]
    })
  });
  const selected = parseOllamaAction(response?.choices?.[0]?.message?.content ?? "", encoded.legalActions);
  return selected && { ...selected, latencyMs: Math.round(performance.now() - started), inputTokens: Number(response?.usage?.prompt_tokens ?? 0), outputTokens: Number(response?.usage?.completion_tokens ?? 0), reasoningTokens: Number(response?.usage?.completion_tokens_details?.reasoning_tokens ?? 0) };
}

async function runApiPolicy(scenario, pickAction) {
  const created = await requestJson(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: scenario.config, initialGrid: scenario.initialGrid }) });
  const decisions = [];
  let done = false;
  while (!done && decisions.length < scenario.maxMoves) {
    const encoded = await requestJson(`${BASE}/api/games/${created.id}/encoded`);
    if (!encoded.legalActions?.length) break;
    const selected = await pickAction(encoded);
    if (!selected) break;
    const moved = await requestJson(`${BASE}/api/games/${created.id}/move`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: selected.action, expectStateHash: encoded.stateHash }) });
    const candidate = encoded.candidates.find((entry) => entry.action === selected.action);
    decisions.push({
      turn: decisions.length,
      before: { stateHash: encoded.stateHash, encodedState: encoded.encodedState, encodedFlat: encoded.encodedFlat, legalActions: encoded.legalActions, actionMask: encoded.actionMask, candidates: encoded.candidates, engine: encoded.meta },
      decision: { action: selected.action, fallback: selected.fallback, latencyMs: selected.latencyMs, inputTokens: selected.inputTokens, outputTokens: selected.outputTokens, reasoningTokens: selected.reasoningTokens },
      after: { stateHash: moved.stateHash, encodedState: candidate?.encodedState ?? null, score: moved.current.score, turn: moved.current.turn, reward: moved.reward, changed: moved.changed, done: moved.done, spawned: moved.spawned, events: moved.info?.events ?? [] }
    });
    done = Boolean(moved.done);
  }
  const final = await requestJson(`${BASE}/api/games/${created.id}`);
  return { score: final.current.score, maxTile: maxTile(final.current.grid), moves: decisions.length, won: final.current.won, over: final.current.over, trace: { version: 1, complete: true, actions: decisions.map((step) => step.decision.action), decisions } };
}

async function runRollout(scenario) {
  const result = await requestJson(`${BASE}/api/bots/tournament`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seeds: [scenario.config.seed], maxMoves: scenario.maxMoves, bots: ["rollout"], config: scenario.config, initialGrid: scenario.initialGrid, includeTraces: true }) });
  const run = result.runs?.[0];
  if (!run?.trace?.complete) throw new Error(`${scenario.scenarioId}: rollout trace missing`);
  return run;
}

function adapterMetadata() {
  if (ADAPTER === "rollout") return { id: "rollout", provider: "rollout", type: "monte-carlo-rollout", thinkingEnabled: false, parameters: { rolloutsPerAction: 6, rolloutDepth: 10, engineCandidateBoards: true } };
  if (ADAPTER === "ollama") return { id: OLLAMA_MODEL, provider: "ollama", type: "non-thinking", thinkingEnabled: false, parameters: { temperature: 0, maxOutputTokens: 16, structuredOutput: "json_schema", engineCandidateBoards: true } };
  if (ADAPTER === "hf") return { id: HF_MODEL, provider: modelProvider(HF_MODEL), type: HF_ENABLE_THINKING ? "reasoning-style" : "non-thinking", thinkingEnabled: HF_ENABLE_THINKING, parameters: { temperature: 0, maxOutputTokens: HF_MAX_OUTPUT_TOKENS, structuredOutput: "json_schema", engineCandidateBoards: true } };
  throw new Error("CHALLENGE_ADAPTER must be rollout, ollama, or hf");
}

function hostedPreflight(scenarios) {
  if (ADAPTER !== "hf") return;
  if (process.env.CHALLENGE_ALLOW_HOSTED !== "1") throw new Error("Set CHALLENGE_ALLOW_HOSTED=1 to authorize hosted inference spending");
  if (!HF_TOKEN) throw new Error("HF_TOKEN is required for the hf adapter");
  const requests = scenarios.reduce((sum, scenario) => sum + scenario.maxMoves, 0);
  const tokenEstimate = (requests * 750 * HF_INPUT_USD_PER_MILLION + requests * HF_MAX_OUTPUT_TOKENS * HF_OUTPUT_USD_PER_MILLION) / 1_000_000;
  const conservative = Math.max(tokenEstimate, requests * HF_OBSERVED_USD_PER_REQUEST);
  if (conservative > HOSTED_COST_CAP_USD) throw new Error(`Hosted preflight $${conservative.toFixed(4)} exceeds cap $${HOSTED_COST_CAP_USD.toFixed(4)}`);
}

async function main() {
  const corpus = JSON.parse(await readFile(CORPUS_PATH, "utf8"));
  const scenarios = corpus.scenarios.filter((scenario) => SCENARIO_FILTER.size === 0 || SCENARIO_FILTER.has(scenario.scenarioId));
  if (!scenarios.length) throw new Error("No challenge scenarios selected");
  hostedPreflight(scenarios);
  const model = adapterMetadata();
  const newRecords = [];

  for (const scenario of scenarios) {
    const run = ADAPTER === "rollout" ? await runRollout(scenario) : await runApiPolicy(scenario, ADAPTER === "ollama" ? pickOllama : pickHuggingFace);
    const latency = latencyMetrics(run.trace);
    const totals = run.trace.decisions.reduce((sum, step) => ({ input: sum.input + Number(step.decision.inputTokens ?? 0), output: sum.output + Number(step.decision.outputTokens ?? 0), reasoning: sum.reasoning + Number(step.decision.reasoningTokens ?? 0), fallbacks: sum.fallbacks + (step.decision.fallback ? 1 : 0) }), { input: 0, output: 0, reasoning: 0, fallbacks: 0 });
    const listedCost = ADAPTER === "hf" ? (totals.input * HF_INPUT_USD_PER_MILLION + totals.output * HF_OUTPUT_USD_PER_MILLION) / 1_000_000 : 0;
    const conservativeCost = ADAPTER === "hf" ? Math.max(listedCost, run.moves * HF_OBSERVED_USD_PER_REQUEST) : 0;
    const record = {
      runId: `challenge:${corpus.corpusVersion}:${scenario.scenarioId}:${model.provider}:${model.id}${model.thinkingEnabled ? `:thinking:${model.parameters.maxOutputTokens}` : ""}`,
      recordedAtISO: new Date().toISOString(),
      experimentId: `curated-challenges-${corpus.corpusVersion}`,
      phase: ADAPTER,
      track: "curated-fixed-board",
      rulesetId: corpus.rulesetId,
      corpus: { id: corpus.corpusId, version: corpus.corpusVersion, schemaVersion: corpus.schemaVersion, replayVersion: corpus.replayVersion },
      scenario: { scenarioId: scenario.scenarioId, scenarioVersion: scenario.scenarioVersion, title: scenario.title, skillTags: scenario.skillTags, maxMoves: scenario.maxMoves, config: scenario.config, initialGrid: scenario.initialGrid },
      model,
      objective: evaluateChallengeTrace(scenario, run.trace),
      metrics: { moves: run.moves, score: run.score, maxTile: run.maxTile, won: run.won, over: run.over, inputTokens: totals.input, outputTokens: totals.output, reasoningTokens: totals.reasoning, fallbackCount: totals.fallbacks, averageModelLatencyMs: latency.average, p95ModelLatencyMs: latency.p95, totalModelLatencyMs: latency.total },
      estimatedCostUsd: { listedTokenRates: listedCost, conservativeObservedRequestRate: conservativeCost, inputUsdPerMillion: ADAPTER === "hf" ? HF_INPUT_USD_PER_MILLION : 0, outputUsdPerMillion: ADAPTER === "hf" ? HF_OUTPUT_USD_PER_MILLION : 0, observedUsdPerRequest: ADAPTER === "hf" ? HF_OBSERVED_USD_PER_REQUEST : 0 },
      trace: run.trace
    };
    await upsertBenchmarkRecord(LEDGER_PATH, record);
    newRecords.push(record);
    console.log(`${scenario.scenarioId}: action=${record.objective.selectedAction ?? "none"} pass=${record.objective.passed} score=${run.score} moves=${run.moves}`);
  }

  const ledger = JSON.parse(await readFile(LEDGER_PATH, "utf8"));
  const corpusRecords = ledger.filter((record) => record.track === "curated-fixed-board" && record.corpus?.id === corpus.corpusId && record.corpus?.version === corpus.corpusVersion);
  const correctedFallbackObjectives = correctFallbackObjectives(corpusRecords);
  if (correctedFallbackObjectives > 0) await writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await writeFile(REPORT_PATH, renderChallengeReport(corpus, corpusRecords), "utf8");
  console.log(JSON.stringify({ ok: true, adapter: ADAPTER, ledger: LEDGER_PATH, report: REPORT_PATH, newRuns: newRecords.length, correctedFallbackObjectives, summary: summarizeChallengeRecords(corpusRecords) }, null, 2));
}

main().catch((error) => {
  console.error(`[challenge:benchmark] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
