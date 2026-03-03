import { runScenario } from "@/lib/binary2048/engine";
import { createReplayCode, parseReplayCode, REPLAY_CODE_MAX_LEN } from "@/lib/binary2048/replay-code";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("replay code helpers", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 333,
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

  it("round-trips compact replay payload through code", () => {
    const exported = runScenario(config, initialGrid, ["left", "up", "right"]);
    const created = createReplayCode(exported);
    const parsed = parseReplayCode(created.code);
    expect(parsed.moves).toEqual(["left", "up", "right"]);
    expect(parsed.header.rulesetId).toBe("binary2048-v1");
    expect(parsed.config.seed).toBe(333);
  });

  it("flags codes above the configured max length", () => {
    const longMoves = Array.from({ length: 2500 }, () => "L");
    const created = createReplayCode({
      header: { rulesetId: "binary2048-v1", engineVersion: "dev", size: 4, seed: 1, createdAt: "x" },
      config,
      initialGrid,
      moves: longMoves
    });
    expect(created.length).toBeGreaterThan(REPLAY_CODE_MAX_LEN);
    expect(created.overLimit).toBe(true);
  });

  it("throws on malformed replay code", () => {
    expect(() => parseReplayCode("%%%bad%%%")).toThrow();
  });
});
