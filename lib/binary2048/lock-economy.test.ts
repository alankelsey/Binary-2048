import { applyLockEconomyPolicy, canUseLockTiles, LOCK_RANKED_ENTITLEMENT } from "@/lib/binary2048/lock-economy";
import type { GameConfig } from "@/lib/binary2048/types";

describe("lock economy policy", () => {
  const config: GameConfig = {
    width: 4,
    height: 4,
    seed: 1,
    winTile: 2048,
    zeroBehavior: "annihilate",
    spawnOnNoopMove: false,
    spawn: {
      pZero: 0.15,
      pOne: 0.72,
      pWildcard: 0.1,
      pLock: 0.03,
      wildcardMultipliers: [2]
    }
  };

  it("allows locks by default for unranked sessions", () => {
    expect(
      canUseLockTiles({
        sessionClass: "unranked",
        userTier: "guest",
        entitlements: []
      })
    ).toBe(true);
  });

  it("disables locks for ranked sessions without entitlement", () => {
    const next = applyLockEconomyPolicy(config, {
      sessionClass: "ranked",
      userTier: "paid",
      entitlements: []
    });

    expect(next.spawn.pLock).toBe(0);
    expect(next.spawn.pOne).toBeCloseTo(0.75, 6);
  });

  it("keeps locks enabled for ranked sessions with entitlement", () => {
    const next = applyLockEconomyPolicy(config, {
      sessionClass: "ranked",
      userTier: "paid",
      entitlements: [LOCK_RANKED_ENTITLEMENT]
    });

    expect(next.spawn.pLock).toBe(0.03);
    expect(next.spawn.pOne).toBe(0.72);
  });
});
