import { buildReplayAudit } from "@/lib/binary2048/replay-audit";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("buildReplayAudit", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 444,
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

  it("returns deterministic hash chains for the same replay", () => {
    const exported = runScenario(config, initialGrid, ["left", "up", "right"]);
    const a = buildReplayAudit(exported);
    const b = buildReplayAudit(exported);
    expect(a).toEqual(b);
    expect(a.stepsHashed).toBe(exported.steps.length);
    expect(a.stepHashes).toHaveLength(exported.steps.length);
  });

  it("changes hash chain when replay steps differ", () => {
    const a = buildReplayAudit(runScenario(config, initialGrid, ["left", "up"]));
    const b = buildReplayAudit(runScenario(config, initialGrid, ["left", "right"]));
    expect(a.finalHash).not.toBe(b.finalHash);
  });
});
