import {
  createDeathByLuckDefinition,
  createDeathByLuckPrototypeGame,
  DEATH_BY_LUCK_MODE,
  DEATH_BY_LUCK_RULESET_ID,
  parseDeathByLuckDefinition
} from "@/lib/binary2048/death-by-luck-prototype";
import type { Cell } from "@/lib/binary2048/types";

describe("Death by Luck explicit mode prototype", () => {
  it("creates a versioned, explicitly identified, wildcard-heavy unranked definition", () => {
    const definition = createDeathByLuckDefinition(9001);

    expect(definition).toMatchObject({
      version: 1,
      mode: DEATH_BY_LUCK_MODE,
      rulesetId: DEATH_BY_LUCK_RULESET_ID,
      sessionClass: "unranked",
      config: { seed: 9001, spawn: { pWildcard: 0.7 } }
    });
    expect(definition.config.spawn.pWildcard).toBeGreaterThan(
      definition.config.spawn.pZero + definition.config.spawn.pLock
    );
  });

  it("round trips serialized identity and configuration without shared arrays", () => {
    const definition = createDeathByLuckDefinition(9002, {
      spawn: { wildcardMultipliers: [2, 8, 16] }
    });
    const parsed = parseDeathByLuckDefinition(JSON.parse(JSON.stringify(definition)));

    expect(parsed).toEqual(definition);
    parsed.config.spawn.wildcardMultipliers.push(32);
    expect(definition.config.spawn.wildcardMultipliers).toEqual([2, 8, 16]);
  });

  it("does not infer mode identity from a high wildcard probability", () => {
    const definition = createDeathByLuckDefinition(9003);
    const withoutMode: Partial<typeof definition> = { ...definition };
    delete withoutMode.mode;

    expect(() => parseDeathByLuckDefinition(withoutMode)).toThrow("Explicit Death by Luck mode required");
    expect(() => parseDeathByLuckDefinition({ ...definition, mode: "classic" })).toThrow(
      "Explicit Death by Luck mode required"
    );
  });

  it("rejects ranked, mismatched-ruleset, and non-wildcard-heavy definitions", () => {
    const definition = createDeathByLuckDefinition(9004);

    expect(() => parseDeathByLuckDefinition({ ...definition, sessionClass: "ranked" })).toThrow(
      "Death by Luck must remain unranked"
    );
    expect(() => parseDeathByLuckDefinition({ ...definition, rulesetId: "binary2048-v1" })).toThrow(
      "Death by Luck ruleset mismatch"
    );
    expect(() => parseDeathByLuckDefinition({
      ...definition,
      config: {
        ...definition.config,
        spawn: { ...definition.config.spawn, pOne: 0.5, pWildcard: 0.4 }
      }
    })).toThrow("wildcard-heavy spawn rate");
  });

  it("creates deterministic engine state only from a valid explicit definition", () => {
    const definition = createDeathByLuckDefinition(9005, { width: 2, height: 2 });
    const initialGrid: Cell[][] = [
      [{ t: "w", m: 2 }, null],
      [null, { t: "n", v: 1 }]
    ];
    const first = createDeathByLuckPrototypeGame(definition, initialGrid);
    const second = createDeathByLuckPrototypeGame(definition, initialGrid);

    expect(first.definition).toEqual(definition);
    expect(first.state.grid).toEqual(initialGrid);
    expect(second.state.grid).toEqual(first.state.grid);
    expect(second.state.seed).toBe(first.state.seed);
  });
});
