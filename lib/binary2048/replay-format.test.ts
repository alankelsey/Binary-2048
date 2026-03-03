import { runScenario } from "@/lib/binary2048/engine";
import { exportToCompactReplay, exportToReplayHeader, toCompactReplayPayload } from "@/lib/binary2048/replay-format";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("replay format helpers", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 808,
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

  it("builds canonical replay header from export", () => {
    const exported = runScenario(config, initialGrid, ["left"]);
    const header = exportToReplayHeader(exported);
    expect(header).toMatchObject({
      replayVersion: 1,
      rulesetId: "binary2048-v1",
      engineVersion: expect.any(String),
      size: 4,
      seed: 808
    });
  });

  it("builds compact replay payload from export", () => {
    const exported = runScenario(config, initialGrid, ["left", "up"]);
    const compact = exportToCompactReplay(exported);
    expect(compact.moves).toEqual(["left", "up"]);
    expect(compact.initialGrid).toEqual(initialGrid);
    expect(compact.config.seed).toBe(808);
  });

  it("normalizes pre-compacted payload shape", () => {
    const compact = toCompactReplayPayload({
      header: { rulesetId: "binary2048-v1", engineVersion: "dev", size: 4, seed: 808, createdAt: "x" },
      config,
      initialGrid,
      moves: ["L", "U", "R"]
    });
    expect(compact.header.replayVersion).toBe(1);
    expect(compact.moves).toEqual(["L", "U", "R"]);
    expect(compact.config.width).toBe(4);
  });
});
