import { sharedOpsEnabled } from "@/lib/binary2048/ops-shared";
import { sharedMongoDb } from "@/lib/binary2048/shared-mongo";
export type ModelRecord = {
  modelId: string;
  family: "bot_policy" | "value_model" | "ranking_model";
  version: string;
  rulesetId: string;
  createdAtISO: string;
  active: boolean;
  metadata?: Record<string, unknown>;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_model_registry?: Map<string, ModelRecord>;
};

const registry = globalStore.__binary2048_model_registry ?? new Map<string, ModelRecord>();
globalStore.__binary2048_model_registry = registry;

function modelKey(modelId: string, version: string) {
  return `${modelId}@${version}`;
}

export async function registerModel(input: Omit<ModelRecord, "createdAtISO"> & { createdAtISO?: string }) {
  const record: ModelRecord = {
    ...input,
    createdAtISO: input.createdAtISO ?? new Date().toISOString()
  };
  if (sharedOpsEnabled()) {
    const collection = (await sharedMongoDb()).collection<ModelRecord & { _id: string }>("model_registry");
    await collection.replaceOne({ _id: modelKey(record.modelId, record.version) }, record, { upsert: true });
  } else registry.set(modelKey(record.modelId, record.version), record);
  return record;
}

export async function resolveModelVersion(modelId: string, requestedVersion?: string) {
  if (sharedOpsEnabled()) {
    const collection = (await sharedMongoDb()).collection<ModelRecord & { _id: string }>("model_registry");
    return requestedVersion
      ? collection.findOne({ _id: modelKey(modelId, requestedVersion) }, { projection: { _id: 0 } })
      : collection.findOne({ modelId, active: true }, { sort: { createdAtISO: -1, version: -1 }, projection: { _id: 0 } });
  }
  if (requestedVersion) {
    return registry.get(modelKey(modelId, requestedVersion)) ?? null;
  }
  const active = Array.from(registry.values())
    .filter((record) => record.modelId === modelId && record.active)
    .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
  return active[0] ?? null;
}

export async function enforceModelPin(modelId: string, expectedVersion: string) {
  const found = (await resolveModelVersion(modelId, expectedVersion));
  if (!found) {
    throw new Error(`Pinned model not found: ${modelId}@${expectedVersion}`);
  }
  return found;
}

export async function listRegisteredModels(): Promise<ModelRecord[]> {
  if (sharedOpsEnabled()) return (await sharedMongoDb()).collection<ModelRecord>("model_registry").find({}, { projection: { _id: 0 } }).sort({ modelId: 1, createdAtISO: -1 }).limit(500).toArray();
  return Array.from(registry.values())
    .map((record) => ({ ...record, metadata: record.metadata ? { ...record.metadata } : undefined }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId) || b.createdAtISO.localeCompare(a.createdAtISO) || b.version.localeCompare(a.version));
}

export function resetModelRegistry() {
  registry.clear();
}
