import { createGame, runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("engine RNG draw contract", () => {
  const base: GameConfig = {
    width: 4,
    height: 4,
    seed: 1701,
    winTile: 2048,
    zeroBehavior: "annihilate",
    spawnOnNoopMove: false,
    spawn: {
      pZero: 0,
      pOne: 1,
      pWildcard: 0,
      pLock: 0,
      wildcardMultipliers: [2, 4, 8]
    }
  };

  const movableGrid: Cell[][] = [
    [{ t: "n", v: 1 }, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  function configFor(tileKind: "one" | "zero" | "wild" | "lock"): GameConfig {
    if (tileKind === "one") return { ...base, spawn: { ...base.spawn, pZero: 0, pOne: 1, pWildcard: 0, pLock: 0 } };
    if (tileKind === "zero") return { ...base, spawn: { ...base.spawn, pZero: 1, pOne: 0, pWildcard: 0, pLock: 0 } };
    if (tileKind === "wild") return { ...base, spawn: { ...base.spawn, pZero: 0, pOne: 0, pWildcard: 1, pLock: 0 } };
    return { ...base, spawn: { ...base.spawn, pZero: 0, pOne: 0, pWildcard: 0, pLock: 1 } };
  }

  it("consumes a fixed 3 RNG draws per spawn across tile branches", () => {
    for (const kind of ["one", "zero", "wild", "lock"] as const) {
      const exported = runScenario(configFor(kind), movableGrid, ["right"]);
      const step = exported.meta.replay.stepLog[0];
      expect(step.rngStepEnd - step.rngStepStart).toBe(3);
    }
  });

  it("consumes 6 RNG draws for initial two-spawn game creation", () => {
    const created = createGame(configFor("one"));
    expect(created.state.rngStep).toBe(6);
  });
});
