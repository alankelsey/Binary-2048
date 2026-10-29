import { DEFAULT_CONFIG } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

export const NUMBERS_ONLY_MODE = "numbers-only" as const;
export const NUMBERS_ONLY_RULESET_ID = "binary2048-v2-numbers-only" as const;
export const NUMBERS_ONLY_SCHEMA_VERSION = 1 as const;

export function createNumbersOnlyConfig(
  seed: number,
  overrides: Partial<Omit<GameConfig, "seed" | "spawn">> = {}
): GameConfig {
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    ...overrides,
    seed,
    zeroBehavior: "annihilate",
    spawn: {
      pZero: 0,
      pOne: 1,
      pWildcard: 0,
      pLock: 0,
      wildcardMultipliers: [2]
    }
  };
  assertNumbersOnlyConfig(config);
  return structuredClone(config);
}

export function assertNumbersOnlyConfig(config: GameConfig): void {
  const spawn = config?.spawn;
  if (!spawn || spawn.pZero !== 0 || spawn.pOne !== 1 || spawn.pWildcard !== 0 || spawn.pLock !== 0) {
    throw new Error("Numbers-only mode requires numeric-only spawn probabilities");
  }
}

export function assertNumbersOnlyIdentity(modeRulesetId: string | undefined): void {
  if (modeRulesetId !== NUMBERS_ONLY_RULESET_ID) {
    throw new Error("Numbers-only mode ruleset identity is invalid");
  }
}

export function assertNumbersOnlyGrid(grid: Cell[][]): void {
  if (!Array.isArray(grid) || grid.some((row) => !Array.isArray(row))) {
    throw new Error("Numbers-only grid must be a two-dimensional array");
  }
  for (const cell of grid.flat()) {
    if (cell === null) continue;
    if (cell.t !== "n" || !Number.isSafeInteger(cell.v) || cell.v < 1 || !Number.isInteger(Math.log2(cell.v))) {
      throw new Error("Numbers-only mode does not allow special or invalid numeric tiles");
    }
  }
}
