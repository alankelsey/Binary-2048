import { createHostedReplayCode, parseHostedReplayCode } from "@/lib/binary2048/replay-hosted-code";
import { resetRunStoreForTests } from "@/lib/binary2048/run-store";
import type { CompactReplayPayload } from "@/lib/binary2048/replay-format";

describe("replay-hosted-code", () => {
  const payload: CompactReplayPayload = {
    header: {
      replayVersion: 1,
      rulesetId: "binary2048-v1",
      engineVersion: "test",
      size: 4,
      seed: 123,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    config: {
      width: 4,
      height: 4,
      seed: 123,
      winTile: 2048,
      zeroBehavior: "annihilate",
      spawnOnNoopMove: false,
      spawn: {
        pZero: 0.15,
        pOne: 0.75,
        pWildcard: 0.1,
        pLock: 0,
        wildcardMultipliers: [2]
      }
    },
    initialGrid: [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ],
    moves: ["left", "up"]
  };

  afterEach(() => {
    resetRunStoreForTests();
  });

  it("creates and parses a hosted replay code", () => {
    return createHostedReplayCode(payload, "hosted-secret").then(async (hosted) => {
      const decoded = await parseHostedReplayCode(hosted.code, "hosted-secret");
      expect(decoded.moves).toEqual(["left", "up"]);
      expect(decoded.header.seed).toBe(123);
    });
  });

  it("rejects expired hosted replay code", async () => {
    const hosted = await createHostedReplayCode(payload, "hosted-secret", 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(parseHostedReplayCode(hosted.code, "hosted-secret")).rejects.toThrow(/expired|not found/i);
  });

  it("rejects tampered hosted replay code signature", async () => {
    const hosted = await createHostedReplayCode(payload, "hosted-secret");
    const tampered = `${hosted.code}x`;
    await expect(parseHostedReplayCode(tampered, "hosted-secret")).rejects.toThrow(/signature/i);
  });
});
