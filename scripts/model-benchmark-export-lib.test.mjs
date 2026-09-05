import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildBenchmarkSplits, exportBenchmarkLedger } from "./model-benchmark-export-lib.mjs";

function tracedRecord(overrides = {}) {
  return {
    schemaVersion: 2,
    runId: "run-1",
    experimentId: "experiment-1",
    phase: "phase-1",
    track: "deterministic-seeded-game",
    rulesetId: "binary2048-v1",
    seed: { value: 100 },
    model: { id: "organization/model:provider", provider: "provider" },
    metrics: { moves: 1, score: 2 },
    trace: {
      version: 1,
      complete: true,
      decisions: [{
        turn: 0,
        before: { stateHash: "a", candidates: [{ action: "L" }] },
        decision: { action: "L", fallback: false, inputTokens: 10, outputTokens: 6 },
        after: { stateHash: "b", score: 2 }
      }]
    },
    ...overrides
  };
}

test("separates hosted, Ollama, and rollout decisions", () => {
  const records = [
    tracedRecord(),
    tracedRecord({ runId: "local", model: { id: "qwen3:8b", provider: "ollama" } }),
    tracedRecord({ runId: "rollout", model: { id: "rollout", provider: "rollout" } })
  ];
  const result = buildBenchmarkSplits(records);
  assert.equal(result.splits.hosted.length, 1);
  assert.equal(result.splits.ollama.length, 1);
  assert.equal(result.splits.rollout.length, 1);
  assert.equal(result.splits.metrics.length, 3);
});

test("keeps summary metrics but excludes incomplete traces from step splits", () => {
  const result = buildBenchmarkSplits([{ schemaVersion: 1, runId: "historical", metrics: { moves: 25 } }]);
  assert.equal(result.splits.metrics.length, 1);
  assert.equal(result.splits.hosted.length, 0);
  assert.equal(result.skippedSummaryOnly, 1);
});

test("rejects a falsely complete trace with missing decisions", () => {
  assert.throws(
    () => buildBenchmarkSplits([tracedRecord({ metrics: { moves: 2 } })]),
    /decision count does not match moves/
  );
});

test("writes JSONL splits and a manifest", async () => {
  const directory = await mkdtemp(join(tmpdir(), "binary2048-model-export-"));
  const ledgerPath = join(directory, "ledger.json");
  const outDirectory = join(directory, "output");
  await writeFile(ledgerPath, JSON.stringify([tracedRecord()]), "utf8");
  const manifest = await exportBenchmarkLedger({ ledgerPath, outDirectory });
  assert.equal(manifest.rows.hosted, 1);
  assert.equal(manifest.rows.metrics, 1);
  const row = JSON.parse((await readFile(join(outDirectory, "hosted_model_steps.jsonl"), "utf8")).trim());
  assert.equal(row.before.candidates[0].action, "L");
  const parquet = await readFile(join(outDirectory, "hosted_model_steps.parquet"));
  assert.equal(parquet.subarray(0, 4).toString(), "PAR1");
  assert.equal(parquet.subarray(-4).toString(), "PAR1");
  assert.match(manifest.sha256["hosted_model_steps.parquet"], /^[a-f0-9]{64}$/);
});
