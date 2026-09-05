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
  assert.deepEqual(records[0], { schemaVersion: 2, runId: "run-1", score: 20 });
});

test("upserts a complete decision trace without losing candidate boards", async () => {
  const directory = await mkdtemp(join(tmpdir(), "binary2048-hf-trace-"));
  const path = join(directory, "runs.json");
  await upsertBenchmarkRecord(path, {
    runId: "trace-1",
    trace: {
      version: 1,
      complete: true,
      actions: ["L"],
      decisions: [{
        turn: 0,
        before: {
          stateHash: "before",
          encodedState: [[{ type: 2, value: 1 }]],
          legalActions: ["L"],
          actionMask: [1, 0, 0, 0],
          candidates: [{ action: "L", encodedState: [[{ type: 2, value: 2 }]] }]
        },
        decision: { action: "L", fallback: false, latencyMs: 12, inputTokens: 10, outputTokens: 6 },
        after: { stateHash: "after", encodedState: [[{ type: 2, value: 2 }]], score: 2, turn: 1 }
      }]
    }
  });
  const [record] = JSON.parse(await readFile(path, "utf8"));
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.trace.decisions[0].before.candidates[0].action, "L");
  assert.equal(record.trace.decisions[0].after.stateHash, "after");
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
