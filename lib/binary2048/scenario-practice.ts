import { isScenarioBuilderState } from "@/lib/binary2048/scenario-draft";
import type { ScenarioBuilderState } from "@/lib/binary2048/scenario-builder";

export const PRACTICE_SCENARIO_STORAGE_KEY = "binary2048.practiceScenario.v1";

export type PracticeScenarioMarker = {
  version: 1;
  gameId: string;
  name: string;
  launchedAtISO: string;
};

export function buildScenarioPracticeRequest(scenario: ScenarioBuilderState) {
  if (!isScenarioBuilderState(scenario)) throw new Error("Scenario structure is invalid.");
  return {
    config: structuredClone(scenario.config),
    initialGrid: structuredClone(scenario.grid),
    mode: scenario.gameMode,
    economy: { sessionClass: "unranked" as const }
  };
}

export function createPracticeScenarioMarker(gameId: string, name: string, launchedAtISO = new Date().toISOString()): PracticeScenarioMarker {
  if (!/^g_[a-zA-Z0-9_-]+$/.test(gameId)) throw new Error("Practice game ID is invalid.");
  return {
    version: 1,
    gameId,
    name: name.trim().slice(0, 80) || "Untitled scenario",
    launchedAtISO
  };
}

export function parsePracticeScenarioMarker(raw: string | null): PracticeScenarioMarker | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PracticeScenarioMarker>;
    if (value.version !== 1 || typeof value.gameId !== "string" || !/^g_[a-zA-Z0-9_-]+$/.test(value.gameId)) return null;
    if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 80) return null;
    if (typeof value.launchedAtISO !== "string" || !Number.isFinite(Date.parse(value.launchedAtISO))) return null;
    return value as PracticeScenarioMarker;
  } catch {
    return null;
  }
}
