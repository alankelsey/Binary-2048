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
      header: {
        replayVersion: 1,
        rulesetId: "binary2048-v1",
        engineVersion: "dev",
        size: 4,
        seed: 808,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      config,
      initialGrid,
      moves: ["L", "U", "R"]
    });
    expect(compact.header.replayVersion).toBe(1);
    expect(compact.moves).toEqual(["L", "U", "R"]);
    expect(compact.config.width).toBe(4);
  });

  it("rejects compact payload when header size does not match config", () => {
    expect(() =>
      toCompactReplayPayload({
        header: {
          replayVersion: 1,
          rulesetId: "binary2048-v1",
          engineVersion: "dev",
          size: 5,
          seed: 808,
          createdAt: "2026-01-01T00:00:00.000Z"
        },
        config,
        initialGrid,
        moves: ["L"]
      })
    ).toThrow(/size must match config/i);
  });

  it("rejects compact payload when createdAt is invalid", () => {
    expect(() =>
      toCompactReplayPayload({
        header: {
          replayVersion: 1,
          rulesetId: "binary2048-v1",
          engineVersion: "dev",
          size: 4,
          seed: 808,
          createdAt: "not-a-date"
        },
        config,
        initialGrid,
        moves: ["L"]
      })
    ).toThrow(/createdAt/i);
  });

  it("property-style: replay header validation is deterministic across random mutations", () => {
    function mulberry32(seed: number) {
      let t = seed >>> 0;
      return function rand() {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    }

    const rand = mulberry32(0xB2048);
    const validPayload = {
      header: {
        replayVersion: 1,
        rulesetId: "binary2048-v1",
        engineVersion: "dev",
        size: 4,
        seed: 808,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      config,
      initialGrid,
      moves: ["L", "U", "R"]
    } as const;

    // Baseline validity check.
    expect(() => toCompactReplayPayload(validPayload)).not.toThrow();

    const cases = 120;
    let rejects = 0;
    for (let i = 0; i < cases; i++) {
      const pick = Math.floor(rand() * 9);
      const payload = JSON.parse(JSON.stringify(validPayload)) as {
        header: {
          replayVersion: unknown;
          rulesetId: unknown;
          engineVersion: unknown;
          size: unknown;
          seed: unknown;
          createdAt: unknown;
        };
        config: GameConfig;
        initialGrid: Cell[][];
        moves: string[];
      };

      switch (pick) {
        case 0:
          payload.header.replayVersion = 2;
          break;
        case 1:
          payload.header.rulesetId = "";
          break;
        case 2:
          payload.header.engineVersion = "";
          break;
        case 3:
          payload.header.size = 5;
          break;
        case 4:
          payload.header.seed = 9999;
          break;
        case 5:
          payload.header.createdAt = "not-a-date";
          break;
        case 6:
          payload.initialGrid.pop();
          break;
        case 7:
          payload.initialGrid[0].pop();
          break;
        default:
          payload.moves = [];
          break;
      }

      expect(() => toCompactReplayPayload(payload)).toThrow();
      rejects += 1;
    }

    expect(rejects).toBe(cases);
  });
});
