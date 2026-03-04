import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("export replay metadata", () => {
  it("includes replay seed and compact move list in export meta", () => {
    const config: GameConfig = {
      width: 4,
      height: 4,
      seed: 123,
      winTile: 2048,
      zeroBehavior: "annihilate",
      spawnOnNoopMove: false,
      spawn: {
        pZero: 0,
        pOne: 1,
        pWildcard: 0,
        pLock: 0,
        wildcardMultipliers: [2]
      }
    };
    const initialGrid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];

    const exported = runScenario(config, initialGrid, ["left", "up", "right"]);

    expect(exported.meta.rulesetId).toBe("binary2048-v1");
    expect(typeof exported.meta.engineVersion).toBe("string");
    expect(exported.meta.replay.seed).toBe(123);
    expect(exported.meta.replay.moves).toEqual(exported.steps.map((step) => step.dir));
    expect(exported.meta.replay.movesApplied).toBe(exported.steps.length);
    expect(Array.isArray(exported.meta.replay.stepLog)).toBe(true);
    expect(exported.meta.replay.stepLog).toHaveLength(exported.steps.length);
    const firstStep = exported.meta.replay.stepLog[0];
    expect(typeof firstStep.i).toBe("number");
    expect(firstStep.dir).toBe(exported.steps[0].dir);
    expect(typeof firstStep.rngStepStart).toBe("number");
    expect(typeof firstStep.rngStepEnd).toBe("number");
    expect(typeof firstStep.scoreDelta).toBe("number");
    expect(typeof firstStep.scoreTotal).toBe("number");
    expect(firstStep.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          t: expect.any(String),
          payload: expect.any(Object)
        })
      ])
    );
    expect(exported.meta.spawnProbs).toEqual({
      zero: 0,
      one: 1,
      wildcard: 0,
      lock: 0,
      wildcardMultipliers: [2]
    });
    expect(exported.meta.undo).toEqual({
      limit: 0,
      used: 0,
      remaining: 0,
      events: []
    });
    expect(exported.meta.integrity.sessionClass).toBe("unranked");
    expect(exported.meta.integrity.source).toBe("created");
  });
});
