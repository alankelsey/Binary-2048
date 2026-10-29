import { applyMove, createGame } from "@/lib/binary2048/engine";
import {
  assertNumbersOnlyConfig,
  assertNumbersOnlyGrid,
  assertNumbersOnlyIdentity,
  createNumbersOnlyConfig,
  NUMBERS_ONLY_MODE,
  NUMBERS_ONLY_RULESET_ID,
  NUMBERS_ONLY_SCHEMA_VERSION
} from "@/lib/binary2048/numbers-only";

describe("numbers-only mode contract", () => {
  it("has explicit versioned identity and a numeric-only spawn distribution", () => {
    const config = createNumbersOnlyConfig(12_001);

    expect({ mode: NUMBERS_ONLY_MODE, rulesetId: NUMBERS_ONLY_RULESET_ID, version: NUMBERS_ONLY_SCHEMA_VERSION })
      .toEqual({ mode: "numbers-only", rulesetId: "binary2048-v2-numbers-only", version: 1 });
    expect(config.spawn).toEqual({
      pZero: 0,
      pOne: 1,
      pWildcard: 0,
      pLock: 0,
      wildcardMultipliers: [2]
    });
  });

  it("rejects special tiles and a non-numeric spawn configuration", () => {
    const config = createNumbersOnlyConfig(12_002);
    expect(() => assertNumbersOnlyConfig({
      ...config,
      spawn: { ...config.spawn, pOne: 0.9, pWildcard: 0.1 }
    })).toThrow("numeric-only spawn probabilities");
    expect(() => assertNumbersOnlyGrid([[{ t: "z" }]])).toThrow("does not allow special");
    expect(() => assertNumbersOnlyGrid([[{ t: "w", m: 2 }]])).toThrow("does not allow special");
    expect(() => assertNumbersOnlyGrid([[{ t: "i" }]])).toThrow("does not allow special");
    expect(() => assertNumbersOnlyIdentity("binary2048-v1")).toThrow("ruleset identity is invalid");
  });

  it("uses standard deterministic merge scoring and terminal behavior", () => {
    const config = createNumbersOnlyConfig(12_003, { width: 2, height: 2, winTile: 4 });
    const initial = [[{ t: "n" as const, v: 2 }, { t: "n" as const, v: 2 }], [null, null]];
    const first = applyMove(createGame(config, initial).state, "left");
    const second = applyMove(createGame(config, initial).state, "left");

    expect(first.state).toMatchObject({ score: 4, turn: 1, won: true });
    expect(first.state.grid.flat().filter(Boolean).every((cell) => cell?.t === "n")).toBe(true);
    expect(second.state.grid).toEqual(first.state.grid);
    expect(second.events).toEqual(first.events);
  });
});
