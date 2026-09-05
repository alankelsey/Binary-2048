import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { modelProvider, upsertBenchmarkRecord } from "./hf-benchmark-ledger.mjs";

test("extracts an explicitly selected inference provider", () => {
  assert.equal(modelProvider("openai/gpt-oss-120b:novita"), "novita");
  assert.equal(modelProvider("organization/model"), "auto");
});

test("creates and upserts records by run id", async () => {
  const directory = await mkdtemp(join(tmpdir(), "binary2048-hf-ledger-"));
  const path = join(directory, "runs.json");
  await upsertBenchmarkRecord(path, { runId: "run-1", score: 10 });
  await upsertBenchmarkRecord(path, { runId: "run-1", score: 20 });
  const records = JSON.parse(await readFile(path, "utf8"));
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], { schemaVersion: 1, runId: "run-1", score: 20 });
});

test("backfilled finalist records retain the required metrics", async () => {
  const records = JSON.parse(await readFile("docs/hf-benchmark-runs.json", "utf8"));
  assert.equal(records.length, 20);
  for (const record of records) {
    assert.equal(record.schemaVersion, 1);
    assert.equal(record.track, "deterministic-seeded-game");
    assert.equal(record.model.parameters.engineCandidateBoards, true);
    for (const field of ["moves", "score", "maxTile", "inputTokens", "outputTokens", "fallbackCount", "averageModelLatencyMs"]) {
      assert.ok(Object.hasOwn(record.metrics, field), `${record.runId} missing metrics.${field}`);
    }
    assert.ok(Object.hasOwn(record, "estimatedCostUsd"));
    assert.ok(Object.hasOwn(record, "rollout"));
  }
});
