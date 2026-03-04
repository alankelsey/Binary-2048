import { runScenario } from "@/lib/binary2048/engine";
import { createReplaySignature, verifyReplaySignature } from "@/lib/binary2048/replay-signature";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("replay signature", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 9001,
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

  it("signs and verifies replay payloads", () => {
    const exported = runScenario(config, initialGrid, ["left", "up"]);
    const signature = createReplaySignature(exported, "sig-secret");
    expect(typeof signature).toBe("string");
    expect(verifyReplaySignature(exported, signature, "sig-secret")).toBe(true);
  });

  it("rejects tampered payload with same signature", () => {
    const exported = runScenario(config, initialGrid, ["left", "up"]);
    const signature = createReplaySignature(exported, "sig-secret");
    const tampered = JSON.parse(JSON.stringify(exported));
    tampered.meta.replay.moves = ["left"];
    expect(verifyReplaySignature(tampered, signature, "sig-secret")).toBe(false);
  });
});
