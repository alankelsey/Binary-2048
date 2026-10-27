import type { ScenarioBuilderState } from "@/lib/binary2048/scenario-builder";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

export const SCENARIO_DRAFT_VERSION = 1 as const;
export const SCENARIO_DRAFTS_STORAGE_KEY = "binary2048.scenarioDrafts.v1";
export const MAX_LOCAL_SCENARIO_DRAFTS = 25;

export type ScenarioDraft = {
  draftVersion: typeof SCENARIO_DRAFT_VERSION;
  id: string;
  name: string;
  createdAtISO: string;
  updatedAtISO: string;
  scenario: ScenarioBuilderState;
};

export function createScenarioDraft(input: {
  id: string;
  name: string;
  scenario: ScenarioBuilderState;
  nowISO?: string;
  existing?: ScenarioDraft;
}): ScenarioDraft {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Draft name is required.");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input.id)) throw new Error("Draft ID is invalid.");
  const nowISO = input.nowISO ?? new Date().toISOString();
  return {
    draftVersion: SCENARIO_DRAFT_VERSION,
    id: input.id,
    name,
    createdAtISO: input.existing?.createdAtISO ?? nowISO,
    updatedAtISO: nowISO,
    scenario: cloneScenario(input.scenario)
  };
}

export function parseScenarioDrafts(raw: string | null): ScenarioDraft[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(isScenarioDraft).map(cloneDraft).slice(0, MAX_LOCAL_SCENARIO_DRAFTS);
  } catch {
    return [];
  }
}

export function upsertScenarioDraft(drafts: ScenarioDraft[], draft: ScenarioDraft): ScenarioDraft[] {
  return [cloneDraft(draft), ...drafts.filter((item) => item.id !== draft.id).map(cloneDraft)]
    .sort((left, right) => right.updatedAtISO.localeCompare(left.updatedAtISO))
    .slice(0, MAX_LOCAL_SCENARIO_DRAFTS);
}

export function isScenarioDraft(value: unknown): value is ScenarioDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ScenarioDraft>;
  return draft.draftVersion === SCENARIO_DRAFT_VERSION &&
    typeof draft.id === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(draft.id) &&
    typeof draft.name === "string" && draft.name.trim().length > 0 && draft.name.length <= 80 &&
    isIsoDate(draft.createdAtISO) && isIsoDate(draft.updatedAtISO) &&
    isScenarioBuilderState(draft.scenario);
}

export function isScenarioBuilderState(value: unknown): value is ScenarioBuilderState {
  if (!value || typeof value !== "object") return false;
  const scenario = value as Partial<ScenarioBuilderState>;
  const config = scenario.config;
  return isDraftConfig(config) &&
    (scenario.gameMode === "classic" || scenario.gameMode === "bitstorm") &&
    ["none", "horizontal", "vertical", "rotational", "four-way"].includes(String(scenario.symmetry)) &&
    Array.isArray(scenario.grid) && scenario.grid.length === config.height &&
    scenario.grid.every((row) => Array.isArray(row) && row.length === config.width && row.every(isDraftCell));
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isDraftConfig(value: unknown): value is GameConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Partial<GameConfig>;
  const spawn = config.spawn;
  return Number.isInteger(config.width) && Number(config.width) >= 2 && Number(config.width) <= 8 &&
    Number.isInteger(config.height) && Number(config.height) >= 2 && Number(config.height) <= 8 &&
    Number.isSafeInteger(config.seed) && Number(config.seed) >= 1 &&
    Number.isSafeInteger(config.winTile) && Number(config.winTile) >= 2 &&
    config.zeroBehavior === "annihilate" && typeof config.spawnOnNoopMove === "boolean" &&
    Boolean(spawn && [spawn.pZero, spawn.pOne, spawn.pWildcard, spawn.pLock].every((item) =>
      typeof item === "number" && Number.isFinite(item) && item >= 0 && item <= 1
    )) &&
    Boolean(spawn && Array.isArray(spawn.wildcardMultipliers) && spawn.wildcardMultipliers.every((item) =>
      Number.isSafeInteger(item) && item >= 2
    ));
}

function isDraftCell(value: unknown): value is Cell {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const cell = value as Record<string, unknown>;
  if (cell.t === "n") return Number.isSafeInteger(cell.v) && Number(cell.v) >= 1;
  if (cell.t === "w") return Number.isSafeInteger(cell.m) && Number(cell.m) >= 2;
  return cell.t === "z" || cell.t === "i";
}

function cloneDraft(draft: ScenarioDraft): ScenarioDraft {
  return { ...draft, scenario: cloneScenario(draft.scenario) };
}

function cloneScenario(scenario: ScenarioBuilderState): ScenarioBuilderState {
  return {
    ...scenario,
    config: {
      ...scenario.config,
      spawn: {
        ...scenario.config.spawn,
        wildcardMultipliers: [...scenario.config.spawn.wildcardMultipliers]
      }
    },
    grid: scenario.grid.map((row) => row.map((cell) => cell === null ? null : { ...cell }))
  };
}
