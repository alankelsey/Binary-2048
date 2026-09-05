import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const EXPORT_SCHEMA_VERSION = 1;
export const SPLIT_FILES = {
  hosted: "hosted_model_steps.jsonl",
  ollama: "ollama_model_steps.jsonl",
  rollout: "rollout_steps.jsonl",
  metrics: "run_metrics.jsonl"
};

function splitFor(record) {
  const provider = String(record?.model?.provider ?? "").toLowerCase();
  const modelId = String(record?.model?.id ?? "").toLowerCase();
  if (provider === "ollama") return "ollama";
  if (provider === "rollout" || modelId === "rollout") return "rollout";
  return "hosted";
}

function jsonLine(value) {
  return JSON.stringify(value);
}

function parquetColumns(rows, kind) {
  const fields = kind === "metrics"
    ? [
        ["run_id", "STRING", (row) => row.runId],
        ["experiment_id", "STRING", (row) => row.experimentId],
        ["phase", "STRING", (row) => row.phase],
        ["seed", "INT32", (row) => row.seed?.value],
        ["model_id", "STRING", (row) => row.model?.id],
        ["provider", "STRING", (row) => row.model?.provider],
        ["model_type", "STRING", (row) => row.model?.type],
        ["thinking_enabled", "BOOLEAN", (row) => row.model?.thinkingEnabled],
        ["moves", "INT32", (row) => row.metrics?.moves],
        ["score", "INT32", (row) => row.metrics?.score],
        ["max_tile", "INT32", (row) => row.metrics?.maxTile],
        ["input_tokens", "INT32", (row) => row.metrics?.inputTokens],
        ["output_tokens", "INT32", (row) => row.metrics?.outputTokens],
        ["fallback_count", "INT32", (row) => row.metrics?.fallbackCount],
        ["average_model_latency_ms", "INT32", (row) => row.metrics?.averageModelLatencyMs],
        ["listed_cost_usd", "DOUBLE", (row) => row.estimatedCostUsd?.listedTokenRates],
        ["conservative_cost_usd", "DOUBLE", (row) => row.estimatedCostUsd?.conservativeObservedRequestRate],
        ["trace_complete", "BOOLEAN", (row) => row.traceComplete],
        ["record_json", "JSON", (row) => row]
      ]
    : [
        ["run_id", "STRING", (row) => row.runId],
        ["experiment_id", "STRING", (row) => row.experimentId],
        ["phase", "STRING", (row) => row.phase],
        ["seed", "INT32", (row) => row.seed],
        ["model_id", "STRING", (row) => row.model?.id],
        ["provider", "STRING", (row) => row.model?.provider],
        ["model_type", "STRING", (row) => row.model?.type],
        ["thinking_enabled", "BOOLEAN", (row) => row.model?.thinkingEnabled],
        ["temperature", "DOUBLE", (row) => row.model?.parameters?.temperature],
        ["max_output_tokens", "INT32", (row) => row.model?.parameters?.maxOutputTokens],
        ["turn", "INT32", (row) => row.turn],
        ["state_hash_before", "STRING", (row) => row.before?.stateHash],
        ["legal_actions_json", "JSON", (row) => row.before?.legalActions],
        ["action_mask_json", "JSON", (row) => row.before?.actionMask],
        ["encoded_state_json", "JSON", (row) => row.before?.encodedState],
        ["candidate_boards_json", "JSON", (row) => row.before?.candidates],
        ["action", "STRING", (row) => row.decision?.action],
        ["fallback", "BOOLEAN", (row) => row.decision?.fallback],
        ["latency_ms", "DOUBLE", (row) => row.decision?.latencyMs],
        ["input_tokens", "INT32", (row) => row.decision?.inputTokens],
        ["output_tokens", "INT32", (row) => row.decision?.outputTokens],
        ["reasoning_tokens", "INT32", (row) => row.decision?.reasoningTokens],
        ["state_hash_after", "STRING", (row) => row.after?.stateHash],
        ["encoded_state_after_json", "JSON", (row) => row.after?.encodedState],
        ["score_after", "INT32", (row) => row.after?.score],
        ["reward", "INT32", (row) => row.after?.reward],
        ["done", "BOOLEAN", (row) => row.after?.done],
        ["step_json", "JSON", (row) => row]
      ];
  return fields.map(([name, type, select]) => ({
    name,
    type,
    nullable: true,
    data: rows.map((row) => {
      const value = select(row);
      if (value === undefined || value === null) return null;
      return type === "JSON" ? JSON.stringify(value) : value;
    })
  }));
}

async function checksum(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export function buildBenchmarkSplits(records) {
  if (!Array.isArray(records)) throw new Error("benchmark ledger root must be an array");
  const splits = { hosted: [], ollama: [], rollout: [], metrics: [] };
  let skippedSummaryOnly = 0;

  for (const record of records) {
    splits.metrics.push({
      exportSchemaVersion: EXPORT_SCHEMA_VERSION,
      sourceSchemaVersion: record.schemaVersion ?? null,
      runId: record.runId,
      recordedAtISO: record.recordedAtISO ?? null,
      experimentId: record.experimentId ?? null,
      phase: record.phase ?? null,
      track: record.track ?? null,
      rulesetId: record.rulesetId ?? null,
      seed: record.seed ?? null,
      model: record.model ?? null,
      metrics: record.metrics ?? null,
      estimatedCostUsd: record.estimatedCostUsd ?? null,
      rollout: record.rollout ?? null,
      traceComplete: Boolean(record?.trace?.complete)
    });

    if (record?.schemaVersion < 2 || record?.trace?.version !== 1 || record?.trace?.complete !== true) {
      skippedSummaryOnly += 1;
      continue;
    }
    if (!Array.isArray(record.trace.decisions) || record.trace.decisions.length !== record.metrics?.moves) {
      throw new Error(`${record.runId}: complete trace decision count does not match moves`);
    }

    const split = splitFor(record);
    for (const step of record.trace.decisions) {
      splits[split].push({
        exportSchemaVersion: EXPORT_SCHEMA_VERSION,
        runId: record.runId,
        experimentId: record.experimentId,
        phase: record.phase,
        track: record.track,
        rulesetId: record.rulesetId,
        seed: record.seed?.value,
        model: record.model,
        turn: step.turn,
        before: step.before,
        decision: step.decision,
        after: step.after
      });
    }
  }
  return { splits, skippedSummaryOnly };
}

export async function exportBenchmarkLedger({ ledgerPath, outDirectory }) {
  const records = JSON.parse(await readFile(ledgerPath, "utf8"));
  const result = buildBenchmarkSplits(records);
  await mkdir(outDirectory, { recursive: true });
  for (const [split, file] of Object.entries(SPLIT_FILES)) {
    const lines = result.splits[split].map(jsonLine);
    await writeFile(join(outDirectory, file), lines.length ? `${lines.join("\n")}\n` : "", "utf8");
  }
  const { parquetWriteFile } = await import("hyparquet-writer");
  const parquetFiles = {};
  for (const [split, rows] of Object.entries(result.splits)) {
    if (rows.length === 0) {
      parquetFiles[split] = null;
      continue;
    }
    const filename = SPLIT_FILES[split].replace(/\.jsonl$/, ".parquet");
    parquetWriteFile({
      filename: join(outDirectory, filename),
      columnData: parquetColumns(rows, split)
    });
    parquetFiles[split] = filename;
  }
  const checksums = {};
  for (const file of [...Object.values(SPLIT_FILES), ...Object.values(parquetFiles).filter(Boolean)]) {
    checksums[file] = await checksum(join(outDirectory, file));
  }
  const manifest = {
    exportSchemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAtISO: new Date().toISOString(),
    source: ledgerPath,
    skippedSummaryOnly: result.skippedSummaryOnly,
    rows: Object.fromEntries(Object.entries(result.splits).map(([name, rows]) => [name, rows.length])),
    files: { jsonl: SPLIT_FILES, parquet: parquetFiles },
    sha256: checksums
  };
  await writeFile(join(outDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}
