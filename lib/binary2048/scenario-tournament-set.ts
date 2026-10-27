import { isScenarioBuilderState } from "@/lib/binary2048/scenario-draft";
import type { ScenarioBuilderState } from "@/lib/binary2048/scenario-builder";
import type { Cell } from "@/lib/binary2048/types";

export const TOURNAMENT_SCENARIO_SET_FORMAT = "binary2048-tournament-scenario-set" as const;
export const TOURNAMENT_SCENARIO_SET_VERSION = 1 as const;

export type TournamentScenarioVariant = "original" | "mirror-horizontal" | "mirror-vertical" | "rotate-180";

export type TournamentScenarioEntry = {
  id: string;
  name: string;
  tags: string[];
  variant: TournamentScenarioVariant;
  seed: number;
  configuration: ScenarioBuilderState["config"];
  gameMode: ScenarioBuilderState["gameMode"];
  initialGrid: ScenarioBuilderState["grid"];
  boardFingerprint: string;
};

export type TournamentScenarioSetFile = {
  format: typeof TOURNAMENT_SCENARIO_SET_FORMAT;
  version: typeof TOURNAMENT_SCENARIO_SET_VERSION;
  id: string;
  name: string;
  tags: string[];
  createdAtISO: string;
  exportedAtISO: string;
  entries: TournamentScenarioEntry[];
};

export function normalizeTournamentTags(value: string | string[]): string[] {
  const values = Array.isArray(value) ? value : value.split(",");
  return [...new Set(values.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
    .slice(0, 12)
    .map((tag) => tag.slice(0, 32));
}

export function addScenarioToTournamentSet(input: {
  entries: TournamentScenarioEntry[];
  scenario: ScenarioBuilderState;
  name?: string;
  tags?: string | string[];
  variants?: TournamentScenarioVariant[];
}): { entries: TournamentScenarioEntry[]; added: TournamentScenarioEntry[]; duplicateCount: number } {
  if (!isScenarioBuilderState(input.scenario)) throw new Error("Scenario structure is invalid.");
  const variants = [...new Set(input.variants?.length ? input.variants : ["original"])] as TournamentScenarioVariant[];
  const fingerprints = new Set(input.entries.map((entry) => entry.boardFingerprint));
  const added: TournamentScenarioEntry[] = [];
  let duplicateCount = 0;

  for (const variant of variants) {
    if (!isTournamentVariant(variant)) throw new Error(`Unsupported tournament variant: ${String(variant)}.`);
    const initialGrid = transformGrid(input.scenario.grid, variant);
    const boardFingerprint = `board_${stableHash(initialGrid)}`;
    if (fingerprints.has(boardFingerprint)) {
      duplicateCount += 1;
      continue;
    }
    fingerprints.add(boardFingerprint);
    const configuration = structuredClone(input.scenario.config);
    const entryContent = {
      configuration,
      gameMode: input.scenario.gameMode,
      initialGrid
    };
    added.push({
      id: `scenario_${stableHash(entryContent)}`,
      name: `${normalizeName(input.name)}${variantSuffix(variant)}`,
      tags: normalizeTournamentTags(input.tags ?? []),
      variant,
      seed: configuration.seed,
      configuration,
      gameMode: input.scenario.gameMode,
      initialGrid,
      boardFingerprint
    });
  }

  return { entries: [...input.entries.map(cloneEntry), ...added], added, duplicateCount };
}

export function createTournamentScenarioSetFile(input: {
  entries: TournamentScenarioEntry[];
  name?: string;
  tags?: string | string[];
  createdAtISO?: string;
  exportedAtISO?: string;
}): TournamentScenarioSetFile {
  if (input.entries.length === 0) throw new Error("Add at least one scenario before exporting a tournament set.");
  const name = normalizeName(input.name, "Untitled tournament set");
  const tags = normalizeTournamentTags(input.tags ?? []);
  const entries = input.entries.map(cloneEntry);
  const exportedAtISO = input.exportedAtISO ?? new Date().toISOString();
  return {
    format: TOURNAMENT_SCENARIO_SET_FORMAT,
    version: TOURNAMENT_SCENARIO_SET_VERSION,
    id: `set_${stableHash({ name, tags, entryIds: entries.map((entry) => entry.id) })}`,
    name,
    tags,
    createdAtISO: input.createdAtISO ?? exportedAtISO,
    exportedAtISO,
    entries
  };
}

export function tournamentScenarioSetFilename(name: string, exportedAtISO: string): string {
  const slug = normalizeName(name, "tournament-set").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tournament-set";
  return `${slug}-${exportedAtISO.replace(/[:.]/g, "-")}.tournament-scenarios.json`;
}

function transformGrid(grid: Cell[][], variant: TournamentScenarioVariant): Cell[][] {
  const cloned = grid.map((row) => row.map(cloneCell));
  if (variant === "original") return cloned;
  if (variant === "mirror-horizontal") return cloned.map((row) => row.reverse());
  if (variant === "mirror-vertical") return cloned.reverse();
  return cloned.reverse().map((row) => row.reverse());
}

function cloneEntry(entry: TournamentScenarioEntry): TournamentScenarioEntry {
  return structuredClone(entry);
}

function cloneCell(cell: Cell): Cell {
  return cell === null ? null : { ...cell };
}

function normalizeName(value: string | undefined, fallback = "Untitled scenario"): string {
  return value?.trim().slice(0, 80) || fallback;
}

function variantSuffix(variant: TournamentScenarioVariant): string {
  if (variant === "mirror-horizontal") return " · horizontal mirror";
  if (variant === "mirror-vertical") return " · vertical mirror";
  if (variant === "rotate-180") return " · 180° rotation";
  return "";
}

function isTournamentVariant(value: string): value is TournamentScenarioVariant {
  return ["original", "mirror-horizontal", "mirror-vertical", "rotate-180"].includes(value);
}

function stableHash(value: unknown): string {
  const text = stableStringify(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
