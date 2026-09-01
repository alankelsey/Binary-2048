#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { buildMovePrompt, parseOllamaAction } from "./ollama-bot-lib.mjs";

function localEnvValue(name) {
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    if (!line) return undefined;
    return line.slice(name.length + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  } catch {
    return undefined;
  }
}

const BASE = process.env.BASE ?? "http://localhost:3000";
const HF_BASE = process.env.HF_BASE ?? "https://router.huggingface.co/v1";
const HF_MODEL = process.env.HF_MODEL ?? "Qwen/Qwen3.5-397B-A17B:deepinfra";
const HF_TOKEN = process.env.HF_TOKEN ?? localEnvValue("HF_TOKEN");
const MAX_MOVES = Number(process.env.MAX_MOVES ?? "25");
const SEED = Number(process.env.SEED ?? "100");
const INPUT_USD_PER_MILLION = Number(process.env.HF_INPUT_USD_PER_MILLION ?? "0.45");
const OUTPUT_USD_PER_MILLION = Number(process.env.HF_OUTPUT_USD_PER_MILLION ?? "3.00");
const OBSERVED_USD_PER_REQUEST = Number(process.env.HF_OBSERVED_USD_PER_REQUEST ?? String(0.25 / 35));
const MAX_ESTIMATED_COST_USD = Number(process.env.HF_MAX_ESTIMATED_COST_USD ?? "5.00");

function estimatedCost(inputTokens, outputTokens) {
  return (inputTokens * INPUT_USD_PER_MILLION + outputTokens * OUTPUT_USD_PER_MILLION) / 1_000_000;
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 240)}`);
  }
  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(`${url} failed: ${message}`);
  }
  return payload;
}

async function pickAction(encoded) {
  const legalActions = encoded?.legalActions;
  if (!Array.isArray(legalActions) || legalActions.length === 0) return null;
  const started = performance.now();
  const response = await requestJson(`${HF_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${HF_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: HF_MODEL,
      temperature: 0,
      max_tokens: 16,
      chat_template_kwargs: { enable_thinking: false },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "binary2048_action",
          strict: true,
          schema: {
            type: "object",
            properties: { action: { type: "string", enum: legalActions } },
            required: ["action"],
            additionalProperties: false
          }
        }
      },
      messages: [
        { role: "system", content: "You are a deterministic Binary 2048 move-selection policy. Do not think aloud." },
        { role: "user", content: buildMovePrompt(encoded.encodedState, legalActions, encoded.candidates) }
      ]
    })
  });
  const content = response?.choices?.[0]?.message?.content ?? "";
  const selected = parseOllamaAction(content, legalActions);
  return selected ? {
    ...selected,
    latencyMs: Math.round(performance.now() - started),
    promptTokens: Number(response?.usage?.prompt_tokens ?? 0),
    outputTokens: Number(response?.usage?.completion_tokens ?? 0)
  } : null;
}

async function play() {
  if (!HF_TOKEN) throw new Error("HF_TOKEN is required");
  if (!Number.isInteger(MAX_MOVES) || MAX_MOVES < 1) throw new Error("MAX_MOVES must be a positive integer");

  // Hugging Face settles the provider-reported charge asynchronously, so the
  // response token counts cannot enforce a real-time dollar cap. Use the
  // dashboard-observed per-request cost as a conservative preflight estimate.
  const preflightCost = MAX_MOVES * OBSERVED_USD_PER_REQUEST;
  if (preflightCost > MAX_ESTIMATED_COST_USD) {
    throw new Error(`Preflight cost $${preflightCost.toFixed(6)} exceeds cap $${MAX_ESTIMATED_COST_USD.toFixed(6)}`);
  }

  const created = await requestJson(`${BASE}/api/games`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config: { seed: SEED } })
  });
  const id = created?.id;
  if (!id) throw new Error("Create game response missing id");

  let moves = 0;
  let fallbackMoves = 0;
  let promptTokens = 0;
  let outputTokens = 0;
  const latencies = [];
  let done = false;
  while (!done && moves < MAX_MOVES) {
    const encoded = await requestJson(`${BASE}/api/games/${id}/encoded`);
    const selected = await pickAction(encoded);
    if (!selected) break;
    if (selected.fallback) fallbackMoves += 1;
    promptTokens += selected.promptTokens;
    outputTokens += selected.outputTokens;
    latencies.push(selected.latencyMs);
    const moved = await requestJson(`${BASE}/api/games/${id}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: selected.action, expectStateHash: encoded.stateHash })
    });
    moves += 1;
    done = Boolean(moved?.done);
    console.log(`move=${moves} action=${selected.action} latencyMs=${selected.latencyMs} promptTokens=${selected.promptTokens} outputTokens=${selected.outputTokens} fallback=${selected.fallback}`);
  }

  const final = await requestJson(`${BASE}/api/games/${id}`);
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(JSON.stringify({
    id,
    model: HF_MODEL,
    seed: SEED,
    moves,
    fallbackMoves,
    promptTokens,
    outputTokens,
    totalTokens: promptTokens + outputTokens,
    listedTokenRateEstimateUsd: Number(estimatedCost(promptTokens, outputTokens).toFixed(8)),
    observedCostEstimateUsd: Number((moves * OBSERVED_USD_PER_REQUEST).toFixed(8)),
    score: final?.current?.score ?? 0,
    maxTile: Math.max(0, ...((final?.current?.grid ?? []).flat().map((cell) => cell?.t === "n" ? cell.v : 0))),
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
    p95LatencyMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null
  }, null, 2));
}

play().catch((error) => {
  console.error(`[hf:bot] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
