import { isScenarioBuilderState } from "@/lib/binary2048/scenario-draft";
import type { ScenarioBuilderState } from "@/lib/binary2048/scenario-builder";

export const SCENARIO_FILE_FORMAT = "binary2048-scenario" as const;
export const SCENARIO_FILE_VERSION = 1 as const;

export type ScenarioFile = {
  format: typeof SCENARIO_FILE_FORMAT;
  version: typeof SCENARIO_FILE_VERSION;
  authoring: {
    name: string;
    createdAtISO: string;
    exportedAtISO: string;
    tool: "binary2048-scenario-builder";
  };
  configuration: ScenarioBuilderState["config"];
  seed: number;
  gameMode: ScenarioBuilderState["gameMode"];
  symmetry: ScenarioBuilderState["symmetry"];
  initialGrid: ScenarioBuilderState["grid"];
};

export function createScenarioFile(input: {
  scenario: ScenarioBuilderState;
  name?: string;
  createdAtISO?: string;
  exportedAtISO?: string;
}): ScenarioFile {
  if (!isScenarioBuilderState(input.scenario)) throw new Error("Scenario structure is invalid.");
  const nowISO = input.exportedAtISO ?? new Date().toISOString();
  return {
    format: SCENARIO_FILE_FORMAT,
    version: SCENARIO_FILE_VERSION,
    authoring: {
      name: normalizeName(input.name),
      createdAtISO: input.createdAtISO ?? nowISO,
      exportedAtISO: nowISO,
      tool: "binary2048-scenario-builder"
    },
    configuration: cloneScenario(input.scenario).config,
    seed: input.scenario.config.seed,
    gameMode: input.scenario.gameMode,
    symmetry: input.scenario.symmetry,
    initialGrid: cloneScenario(input.scenario).grid
  };
}

export function parseScenarioFile(value: unknown): { file: ScenarioFile; scenario: ScenarioBuilderState } {
  if (!value || typeof value !== "object") throw new Error("Scenario JSON must contain an object.");
  const file = value as Partial<ScenarioFile>;
  if (file.format !== SCENARIO_FILE_FORMAT) throw new Error("Not a Binary 2048 scenario file.");
  if (file.version !== SCENARIO_FILE_VERSION) throw new Error(`Unsupported scenario file version: ${String(file.version)}.`);
  if (!isAuthoring(file.authoring)) throw new Error("Scenario authoring metadata is invalid.");
  const scenario = {
    config: file.configuration,
    gameMode: file.gameMode,
    symmetry: file.symmetry,
    grid: file.initialGrid
  };
  if (!isScenarioBuilderState(scenario)) throw new Error("Scenario structure is invalid.");
  if (file.seed !== scenario.config.seed) throw new Error("Scenario seed does not match its configuration.");
  const cloned = cloneScenario(scenario);
  return { file: { ...file, configuration: cloned.config, initialGrid: cloned.grid } as ScenarioFile, scenario: cloned };
}

export function parseScenarioJson(text: string): { file: ScenarioFile; scenario: ScenarioBuilderState } {
  if (new Blob([text]).size > 256 * 1024) throw new Error("Scenario JSON must be 256 KB or smaller.");
  try {
    return parseScenarioFile(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Scenario JSON is not valid JSON.");
    throw error;
  }
}

export function scenarioFilename(name: string, exportedAtISO: string): string {
  const slug = normalizeName(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scenario";
  return `${slug}-${exportedAtISO.replace(/[:.]/g, "-")}.scenario.json`;
}

function normalizeName(value: string | undefined): string {
  return value?.trim().slice(0, 80) || "Untitled scenario";
}

function isAuthoring(value: unknown): value is ScenarioFile["authoring"] {
  if (!value || typeof value !== "object") return false;
  const authoring = value as Partial<ScenarioFile["authoring"]>;
  return typeof authoring.name === "string" && authoring.name.trim().length > 0 && authoring.name.length <= 80 &&
    typeof authoring.createdAtISO === "string" && Number.isFinite(Date.parse(authoring.createdAtISO)) &&
    typeof authoring.exportedAtISO === "string" && Number.isFinite(Date.parse(authoring.exportedAtISO)) &&
    authoring.tool === "binary2048-scenario-builder";
}

function cloneScenario(scenario: ScenarioBuilderState): ScenarioBuilderState {
  return structuredClone(scenario);
}
