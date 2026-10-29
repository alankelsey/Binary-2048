import { createGame } from "@/lib/binary2048/engine";
import type { Cell, GameConfig, GameState } from "@/lib/binary2048/types";

export const DEATH_BY_LUCK_MODE = "death-by-luck" as const;
export const DEATH_BY_LUCK_RULESET_ID = "binary2048-v2-death-by-luck" as const;
export const DEATH_BY_LUCK_SCHEMA_VERSION = 1 as const;
export const DEATH_BY_LUCK_MIN_WILDCARD_RATE = 0.5;

export type DeathByLuckDefinition = {
  version: typeof DEATH_BY_LUCK_SCHEMA_VERSION;
  mode: typeof DEATH_BY_LUCK_MODE;
  rulesetId: typeof DEATH_BY_LUCK_RULESET_ID;
  sessionClass: "unranked";
  config: GameConfig;
};

export type DeathByLuckPrototypeGame = {
  definition: DeathByLuckDefinition;
  state: GameState;
};

export function createDeathByLuckDefinition(
  seed: number,
  overrides: Partial<Omit<GameConfig, "seed" | "spawn">> & { spawn?: Partial<GameConfig["spawn"]> } = {}
): DeathByLuckDefinition {
  const config: GameConfig = {
    width: overrides.width ?? 4,
    height: overrides.height ?? 4,
    seed,
    winTile: overrides.winTile ?? 2048,
    zeroBehavior: overrides.zeroBehavior ?? "annihilate",
    spawnOnNoopMove: overrides.spawnOnNoopMove ?? false,
    spawn: {
      pZero: overrides.spawn?.pZero ?? 0.07,
      pOne: overrides.spawn?.pOne ?? 0.2,
      pWildcard: overrides.spawn?.pWildcard ?? 0.7,
      pLock: overrides.spawn?.pLock ?? 0.03,
      wildcardMultipliers: [...(overrides.spawn?.wildcardMultipliers ?? [2, 4, 8])]
    }
  };
  const definition: DeathByLuckDefinition = {
    version: DEATH_BY_LUCK_SCHEMA_VERSION,
    mode: DEATH_BY_LUCK_MODE,
    rulesetId: DEATH_BY_LUCK_RULESET_ID,
    sessionClass: "unranked",
    config
  };
  validateDefinition(definition);
  return cloneDefinition(definition);
}

export function parseDeathByLuckDefinition(value: unknown): DeathByLuckDefinition {
  validateDefinition(value);
  return cloneDefinition(value);
}

export function createDeathByLuckPrototypeGame(
  definition: DeathByLuckDefinition,
  initialGrid?: Cell[][]
): DeathByLuckPrototypeGame {
  const parsed = parseDeathByLuckDefinition(definition);
  const state = createGame(parsed.config, initialGrid).state;
  return { definition: parsed, state };
}

function validateDefinition(value: unknown): asserts value is DeathByLuckDefinition {
  if (!value || typeof value !== "object") throw new Error("Death by Luck definition must be an object");
  const definition = value as Partial<DeathByLuckDefinition>;
  if (definition.version !== DEATH_BY_LUCK_SCHEMA_VERSION) throw new Error("Unsupported Death by Luck version");
  if (definition.mode !== DEATH_BY_LUCK_MODE) throw new Error("Explicit Death by Luck mode required");
  if (definition.rulesetId !== DEATH_BY_LUCK_RULESET_ID) throw new Error("Death by Luck ruleset mismatch");
  if (definition.sessionClass !== "unranked") throw new Error("Death by Luck must remain unranked");
  const config = definition.config;
  if (!config || !Number.isSafeInteger(config.seed) || config.seed < 1) throw new Error("Death by Luck seed must be positive");
  if (!Number.isInteger(config.width) || !Number.isInteger(config.height) || config.width < 2 || config.height < 2) {
    throw new Error("Death by Luck dimensions are invalid");
  }
  const spawn = config.spawn;
  if (!spawn) throw new Error("Death by Luck spawn configuration required");
  const total = spawn.pZero + spawn.pOne + spawn.pWildcard + spawn.pLock;
  if (Math.abs(total - 1) > 1e-6) throw new Error("Death by Luck spawn probabilities must total 1");
  if (spawn.pWildcard < DEATH_BY_LUCK_MIN_WILDCARD_RATE) {
    throw new Error("Death by Luck requires a wildcard-heavy spawn rate");
  }
  if (!Array.isArray(spawn.wildcardMultipliers) || spawn.wildcardMultipliers.length === 0) {
    throw new Error("Death by Luck wildcard multipliers required");
  }
}

function cloneDefinition(definition: DeathByLuckDefinition): DeathByLuckDefinition {
  return {
    ...definition,
    config: {
      ...definition.config,
      spawn: {
        ...definition.config.spawn,
        wildcardMultipliers: [...definition.config.spawn.wildcardMultipliers]
      }
    }
  };
}
