import type { GameConfig } from "@/lib/binary2048/types";
import type { UserTier } from "@/lib/binary2048/security-policy";

export type LockEconomyContext = {
  sessionClass: "ranked" | "unranked";
  userTier: UserTier;
  entitlements: string[];
};

export const LOCK_RANKED_ENTITLEMENT = "lock_tiles_ranked";

export function canUseLockTiles(context: LockEconomyContext): boolean {
  if (context.sessionClass === "unranked") return true;
  return context.entitlements.includes(LOCK_RANKED_ENTITLEMENT);
}

export function applyLockEconomyPolicy(config: GameConfig, context: LockEconomyContext): GameConfig {
  if (canUseLockTiles(context)) return config;
  if (config.spawn.pLock <= 0) return config;

  // Disable lock spawn while preserving probability normalization.
  return {
    ...config,
    spawn: {
      ...config.spawn,
      pOne: config.spawn.pOne + config.spawn.pLock,
      pLock: 0
    }
  };
}
