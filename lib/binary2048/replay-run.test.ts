import { runReplay } from "@/lib/binary2048/replay-run";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("runReplay", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 919,
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

  it("reconstructs final state from full export payload", () => {
    const exported = runScenario(config, initialGrid, ["left", "up", "right"]);
    const replay = runReplay(exported);

    expect(replay.rulesetId).toBe("binary2048-v1");
    expect(replay.movesApplied).toBe(exported.steps.length);
    expect(replay.final.score).toBe(exported.final.score);
    expect(replay.final.grid).toEqual(exported.final.grid);
  });

  it("reconstructs final state from replay request payload", () => {
    const replay = runReplay({
      header: { rulesetId: "binary2048-v1", seed: 919 },
      config,
      initialGrid,
      moves: ["L", "U", "R"]
    });

    expect(replay.rulesetId).toBe("binary2048-v1");
    expect(replay.movesApplied).toBe(3);
    expect(typeof replay.totalScore).toBe("number");
  });

  it("rejects unsupported rulesets", () => {
    expect(() =>
      runReplay({
        header: { rulesetId: "binary2048-v999" },
        config,
        initialGrid,
        moves: ["L"]
      })
    ).toThrow("Unsupported rulesetId");
  });
});
