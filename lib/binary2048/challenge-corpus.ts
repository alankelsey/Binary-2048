import corpusJson from "@/data/model-benchmark/challenge-corpus.v1.json";
import { parseAction, type ActionCode } from "@/lib/binary2048/action";
import { legalActionCodes } from "@/lib/binary2048/ai";
import { applyMove, createGame } from "@/lib/binary2048/engine";
import { validateReplayHeader } from "@/lib/binary2048/replay-format";
import type { Cell, GameConfig, GameEvent } from "@/lib/binary2048/types";

type TileCountKey = "number" | "zero" | "wildcard" | "lock";

export type ChallengeProbe = {
  action: ActionCode;
  moved: boolean;
  scoreDelta?: number;
  mergeCount?: number;
  eventTypesContaining?: GameEvent["type"][];
  resultingMaxNumberTile?: number;
  resultingTileCounts?: Partial<Record<TileCountKey, number>>;
  won?: boolean;
};

export type CuratedChallengeScenario = {
  scenarioId: string;
  scenarioVersion: number;
  title: string;
  description: string;
  skillTags: string[];
  maxMoves: number;
  config: GameConfig;
  initialGrid: Cell[][];
  expectedInvariants: {
    initialOccupiedCells: number;
    legalActionsContaining: ActionCode[];
    probes: ChallengeProbe[];
  };
};

export type CuratedChallengeCorpus = {
  schemaVersion: 1;
  corpusId: string;
  corpusVersion: string;
  rulesetId: "binary2048-v1";
  replayVersion: 1;
  scenarios: CuratedChallengeScenario[];
};

function tileCounts(grid: Cell[][]): Record<TileCountKey, number> {
  const counts = { number: 0, zero: 0, wildcard: 0, lock: 0 };
  for (const cell of grid.flat()) {
    if (cell?.t === "n") counts.number += 1;
    if (cell?.t === "z") counts.zero += 1;
    if (cell?.t === "w") counts.wildcard += 1;
    if (cell?.t === "i") counts.lock += 1;
  }
  return counts;
}

export function validateChallengeCorpus(value: unknown): CuratedChallengeCorpus {
  const corpus = value as CuratedChallengeCorpus;
  if (corpus?.schemaVersion !== 1 || corpus.rulesetId !== "binary2048-v1" || corpus.replayVersion !== 1) {
    throw new Error("Unsupported curated challenge corpus version");
  }
  if (!corpus.corpusId || !corpus.corpusVersion || !Array.isArray(corpus.scenarios) || corpus.scenarios.length === 0) {
    throw new Error("Curated challenge corpus metadata or scenarios are missing");
  }

  const ids = new Set<string>();
  for (const scenario of corpus.scenarios) {
    if (!scenario.scenarioId || ids.has(scenario.scenarioId)) throw new Error(`Duplicate or missing scenarioId: ${scenario.scenarioId}`);
    ids.add(scenario.scenarioId);
    if (!Number.isInteger(scenario.scenarioVersion) || scenario.scenarioVersion < 1) throw new Error(`${scenario.scenarioId}: invalid scenarioVersion`);
    if (!Number.isInteger(scenario.maxMoves) || scenario.maxMoves < 1) throw new Error(`${scenario.scenarioId}: invalid maxMoves`);
    if (!scenario.skillTags.length || !scenario.description) throw new Error(`${scenario.scenarioId}: missing research metadata`);

    const { state } = createGame(scenario.config, scenario.initialGrid);
    validateReplayHeader(
      {
        replayVersion: corpus.replayVersion,
        rulesetId: corpus.rulesetId,
        engineVersion: `challenge-corpus-${corpus.corpusVersion}`,
        size: scenario.config.width,
        seed: scenario.config.seed,
        createdAt: new Date(0).toISOString()
      },
      scenario.config,
      scenario.initialGrid
    );

    const occupied = state.grid.flat().filter(Boolean).length;
    if (occupied !== scenario.expectedInvariants.initialOccupiedCells) throw new Error(`${scenario.scenarioId}: initial occupied-cell invariant failed`);
    const legal = legalActionCodes(state);
    for (const action of scenario.expectedInvariants.legalActionsContaining) {
      if (!legal.includes(action)) throw new Error(`${scenario.scenarioId}: expected legal action ${action}`);
    }

    for (const probe of scenario.expectedInvariants.probes) {
      const dir = parseAction(probe.action);
      if (!dir) throw new Error(`${scenario.scenarioId}: invalid probe action ${probe.action}`);
      const result = applyMove(state, dir);
      if (result.moved !== probe.moved) throw new Error(`${scenario.scenarioId}/${probe.action}: moved invariant failed`);
      const scoreDelta = result.state.score - state.score;
      if (probe.scoreDelta !== undefined && scoreDelta !== probe.scoreDelta) throw new Error(`${scenario.scenarioId}/${probe.action}: score invariant failed`);
      const mergeCount = result.events.filter((event) => event.type === "merge").length;
      if (probe.mergeCount !== undefined && mergeCount !== probe.mergeCount) throw new Error(`${scenario.scenarioId}/${probe.action}: merge invariant failed`);
      for (const eventType of probe.eventTypesContaining ?? []) {
        if (!result.events.some((event) => event.type === eventType)) throw new Error(`${scenario.scenarioId}/${probe.action}: missing ${eventType} event`);
      }
      const maxNumberTile = Math.max(0, ...result.state.grid.flat().map((cell) => cell?.t === "n" ? cell.v : 0));
      if (probe.resultingMaxNumberTile !== undefined && maxNumberTile !== probe.resultingMaxNumberTile) throw new Error(`${scenario.scenarioId}/${probe.action}: max-tile invariant failed`);
      const counts = tileCounts(result.state.grid);
      for (const [key, expected] of Object.entries(probe.resultingTileCounts ?? {})) {
        if (counts[key as TileCountKey] !== expected) throw new Error(`${scenario.scenarioId}/${probe.action}: ${key} count invariant failed`);
      }
      if (probe.won !== undefined && result.state.won !== probe.won) throw new Error(`${scenario.scenarioId}/${probe.action}: win invariant failed`);
    }
  }
  return corpus;
}

export const CURATED_CHALLENGE_CORPUS = validateChallengeCorpus(corpusJson);
