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
  const manifest = {
    exportSchemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAtISO: new Date().toISOString(),
    source: ledgerPath,
    skippedSummaryOnly: result.skippedSummaryOnly,
    rows: Object.fromEntries(Object.entries(result.splits).map(([name, rows]) => [name, rows.length])),
    files: SPLIT_FILES
  };
  await writeFile(join(outDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}
