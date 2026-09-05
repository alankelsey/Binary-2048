import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const BENCHMARK_SCHEMA_VERSION = 1;

export function modelProvider(model) {
  const separator = model.lastIndexOf(":");
  return separator > model.lastIndexOf("/") ? model.slice(separator + 1) : "auto";
}

export async function upsertBenchmarkRecord(path, record) {
  let records = [];
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("ledger root must be an array");
    records = parsed;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const normalized = { schemaVersion: BENCHMARK_SCHEMA_VERSION, ...record };
  const index = records.findIndex((entry) => entry.runId === normalized.runId);
  if (index >= 0) records[index] = normalized;
  else records.push(normalized);

  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
  return normalized;
}
