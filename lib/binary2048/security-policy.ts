export type UserTier = "guest" | "authed" | "paid";

export type TierContext = {
  isAuthenticated: boolean;
  isPaid: boolean;
};

export type RateLimitPolicy = {
  tier: UserTier;
  windowSeconds: number;
  maxRequests: number;
  challengeAfter: number;
  blockAfter: number;
};

const WINDOW_SECONDS = 300;

const DEFAULT_LIMITS: Record<UserTier, { maxRequests: number; challengeAfter: number; blockAfter: number }> = {
  guest: { maxRequests: 120, challengeAfter: 80, blockAfter: 140 },
  authed: { maxRequests: 600, challengeAfter: 500, blockAfter: 700 },
  paid: { maxRequests: 1800, challengeAfter: 1600, blockAfter: 2000 }
};

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function envKey(tier: UserTier, key: "MAX" | "CHALLENGE" | "BLOCK") {
  const name = tier.toUpperCase();
  return `BINARY2048_RATE_LIMIT_${name}_5M_${key}`;
}

export function resolveUserTier(context: TierContext): UserTier {
  if (context.isPaid) return "paid";
  if (context.isAuthenticated) return "authed";
  return "guest";
}

export function getRateLimitPolicy(
  tier: UserTier,
  env: Record<string, string | undefined> = process.env
): RateLimitPolicy {
  const defaults = DEFAULT_LIMITS[tier];
  const maxRequests = parsePositiveInt(env[envKey(tier, "MAX")]) ?? defaults.maxRequests;
  const challengeAfter = parsePositiveInt(env[envKey(tier, "CHALLENGE")]) ?? defaults.challengeAfter;
  const blockAfter = parsePositiveInt(env[envKey(tier, "BLOCK")]) ?? defaults.blockAfter;

  return {
    tier,
    windowSeconds: WINDOW_SECONDS,
    maxRequests,
    challengeAfter,
    blockAfter
  };
}
