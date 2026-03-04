import { LOCK_RANKED_ENTITLEMENT } from "@/lib/binary2048/lock-economy";
import type { UserTier } from "@/lib/binary2048/security-policy";

export function deriveEntitlementsForTier(tier: UserTier, fromClaims: string[] = []) {
  const set = new Set(fromClaims.filter((item) => typeof item === "string"));
  if (tier === "paid") set.add(LOCK_RANKED_ENTITLEMENT);
  return Array.from(set);
}
