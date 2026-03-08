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

export function registerModel(input: Omit<ModelRecord, "createdAtISO"> & { createdAtISO?: string }) {
  const record: ModelRecord = {
    ...input,
    createdAtISO: input.createdAtISO ?? new Date().toISOString()
  };
  registry.set(modelKey(record.modelId, record.version), record);
  return record;
}

export function resolveModelVersion(modelId: string, requestedVersion?: string) {
  if (requestedVersion) {
    return registry.get(modelKey(modelId, requestedVersion)) ?? null;
  }
  const active = Array.from(registry.values())
    .filter((record) => record.modelId === modelId && record.active)
    .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
  return active[0] ?? null;
}

export function enforceModelPin(modelId: string, expectedVersion: string) {
  const found = resolveModelVersion(modelId, expectedVersion);
  if (!found) {
    throw new Error(`Pinned model not found: ${modelId}@${expectedVersion}`);
  }
  return found;
}

export function resetModelRegistry() {
  registry.clear();
}
