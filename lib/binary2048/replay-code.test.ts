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

  it("auto-compresses oversized replay payloads to reduce code length", () => {
    const longMoves = Array.from({ length: 2500 }, () => "L");
    const created = createReplayCode({
      header: { rulesetId: "binary2048-v1", engineVersion: "dev", size: 4, seed: 1, createdAt: "x" },
      config,
      initialGrid,
      moves: longMoves
    });
    expect(created.compressed).toBe(true);
    expect(created.length).toBeLessThanOrEqual(REPLAY_CODE_MAX_LEN);
    expect(created.overLimit).toBe(false);
    const parsed = parseReplayCode(created.code);
    expect(parsed.moves).toHaveLength(2500);
  });

  it("parses legacy replay codes without version prefix", () => {
    const legacyPayload = {
      header: { rulesetId: "binary2048-v1", engineVersion: "dev", size: 4, seed: 1, createdAt: "x" },
      config,
      initialGrid,
      moves: ["L", "R"]
    };
    const legacyCode = Buffer.from(JSON.stringify(legacyPayload), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const parsed = parseReplayCode(legacyCode);
    expect(parsed.moves).toEqual(["L", "R"]);
  });

  it("throws on malformed replay code", () => {
    expect(() => parseReplayCode("%%%bad%%%")).toThrow();
  });

  it("round-trips signed replay code and rejects tampered signature", () => {
    const exported = runScenario(config, initialGrid, ["left", "up", "right"]);
    const created = createReplayCode(exported, "replay-secret");
    expect(created.signed).toBe(true);

    const parsed = parseReplayCode(created.code, "replay-secret");
    expect(parsed.moves).toEqual(["left", "up", "right"]);

    const tampered = `${created.code}x`;
    expect(() => parseReplayCode(tampered, "replay-secret")).toThrow("invalid replay code signature");
  });
});
