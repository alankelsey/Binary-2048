import { runScenario } from "@/lib/binary2048/engine";
import { createReplaySignature } from "@/lib/binary2048/replay-signature";
import { validateReplay } from "@/lib/binary2048/replay-validate";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("validateReplay", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 4321,
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

  it("validates deterministic replay payloads", () => {
    const exported = runScenario(config, initialGrid, ["left", "up", "right"]);
    const result = validateReplay(exported);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("OK");
    expect(result.details?.rulesetId).toBe("binary2048-v1");
    expect(typeof result.details?.finalStateHash).toBe("string");
  });

  it("rejects invalid replay payloads with reason", () => {
    const result = validateReplay({ moves: [] });
    expect(result.ok).toBe(false);
    expect(typeof result.reason).toBe("string");
  });

  it("rejects unsupported rulesets", () => {
    const result = validateReplay({
      header: {
        replayVersion: 1,
        rulesetId: "binary2048-v999",
        engineVersion: "dev",
        size: 4,
        seed: 4321,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      config,
      initialGrid,
      moves: ["L"]
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Unsupported rulesetId");
  });

  it("verifies replay signature when provided", () => {
    const exported = runScenario(config, initialGrid, ["left", "up"]);
    const signature = createReplaySignature(exported, "sig-secret");
    const ok = validateReplay(exported, { signature, signingSecret: "sig-secret" });
    expect(ok.ok).toBe(true);

    const fail = validateReplay(exported, { signature, signingSecret: "wrong-secret" });
    expect(fail.ok).toBe(false);
    expect(fail.reason).toContain("Invalid replay signature");
  });

  it("rejects replay when engine version pinning is exact and version mismatches", () => {
    const exported = runScenario(config, initialGrid, ["left"]);
    const result = validateReplay(exported, {
      expectedEngineVersion: "1.2.3",
      enginePinMode: "exact"
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Engine version mismatch");
  });

  it("allows replay when engine version pinning uses minor compatibility", () => {
    const compactPayload = {
      header: {
        replayVersion: 1 as const,
        rulesetId: "binary2048-v1",
        engineVersion: "1.2.3",
        size: 4,
        seed: 4321,
        createdAt: "2026-01-01T00:00:00.000Z"
      },
      config,
      initialGrid,
      moves: ["left"]
    };
    const result = validateReplay(compactPayload, {
      expectedEngineVersion: "1.2.99",
      enginePinMode: "minor"
    });
    expect(result.ok).toBe(true);
  });
});
