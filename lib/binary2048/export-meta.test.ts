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
  });
});
