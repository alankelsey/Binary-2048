import { getGameImportErrorMessage, toGameImportPayload } from "@/lib/binary2048/game-import";
import { runScenario } from "@/lib/binary2048/engine";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("game import", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 2048,
    winTile: 2048,
    zeroBehavior: "annihilate",
    spawnOnNoopMove: false,
    spawn: {
      pZero: 0.15,
      pOne: 0.73,
      pWildcard: 0.04,
      pLock: 0.08,
      wildcardMultipliers: [2]
    }
  };
  const initialGrid: Cell[][] = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, { t: "n", v: 1 }],
    [{ t: "i" }, null, null, null]
  ];

  it("converts a full export to the compact recovery schema", () => {
    const exported = runScenario(config, initialGrid, ["left", "down", "right"]);

    expect(toGameImportPayload(exported)).toEqual({
      recoveryVersion: 1,
      rulesetId: "binary2048-v1",
      config,
      initialGrid,
      moves: ["left", "down", "right"]
    });
  });

  it("leaves recovery payloads unchanged", () => {
    const recovery = {
      recoveryVersion: 1,
      rulesetId: "binary2048-v1",
      config,
      initialGrid,
      moves: ["left"]
    };
    expect(toGameImportPayload(recovery)).toBe(recovery);
  });

  it("returns specific edge-security and size errors", () => {
    expect(getGameImportErrorMessage(403)).toContain("site security");
    expect(getGameImportErrorMessage(413)).toBe("Import file is too large.");
    expect(getGameImportErrorMessage(400, "Unsupported recovery snapshot")).toBe(
      "Unsupported recovery snapshot"
    );
  });
});
