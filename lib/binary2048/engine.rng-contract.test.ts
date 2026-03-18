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

  it("generates distinct game ids across new sessions", () => {
    const a = createGame(configFor("one"));
    const b = createGame(configFor("one"));
    expect(a.state.id).not.toBe(b.state.id);
    expect(a.state.id).toMatch(/^g_[a-z0-9]+_[a-z0-9]+$/);
    expect(b.state.id).toMatch(/^g_[a-z0-9]+_[a-z0-9]+$/);
  });

  it("keeps wildcard multiplier replay-compatible for fixed seed", () => {
    const cfg = configFor("wild");
    const a = runScenario(cfg, movableGrid, ["right", "left", "right"]);
    const b = runScenario(cfg, movableGrid, ["right", "left", "right"]);
    expect(a.meta.replay.stepLog.map((s) => s.spawned?.tile)).toEqual(b.meta.replay.stepLog.map((s) => s.spawned?.tile));
    expect(a.meta.replay.stepLog.map((s) => [s.rngStepStart, s.rngStepEnd])).toEqual(
      b.meta.replay.stepLog.map((s) => [s.rngStepStart, s.rngStepEnd])
    );
  });
});
