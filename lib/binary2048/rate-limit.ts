type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type CheckRateLimitInput = {
  req: Request;
  route: string;
  max: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_rate_limit_buckets?: Map<string, RateLimitBucket>;
};

const buckets = globalStore.__binary2048_rate_limit_buckets ?? new Map<string, RateLimitBucket>();
globalStore.__binary2048_rate_limit_buckets = buckets;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return value;
}

function getClientIdentifier(req: Request): string {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey && apiKey.trim().length > 0) return `key:${apiKey.trim()}`;

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor && forwardedFor.trim().length > 0) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return `ip:${ip}`;
  }
  return "ip:unknown";
}

export function checkRateLimit(input: CheckRateLimitInput): RateLimitResult {
  const now = Date.now();
  const key = `${input.route}:${getClientIdentifier(input.req)}`;
  const existing = buckets.get(key);
  const windowMs = Math.max(1000, input.windowMs);
  const limit = Math.max(1, input.max);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      key,
      limit,
      remaining: limit - 1,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000))
    };
  }

  const nextCount = existing.count + 1;
  existing.count = nextCount;
  buckets.set(key, existing);
  const remaining = Math.max(0, limit - nextCount);
  return {
    allowed: nextCount <= limit,
    key,
    limit,
    remaining,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  };
}

export function checkTournamentRateLimit(req: Request) {
  return checkRateLimit({
    req,
    route: "bots_tournament",
    max: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_TOURNAMENT_MAX, 10),
    windowMs: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000)
  });
}

export function checkSimulateRateLimit(req: Request) {
  return checkRateLimit({
    req,
    route: "simulate",
    max: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_SIMULATE_MAX, 60),
    windowMs: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000)
  });
}

export function checkTrainingRateLimit(req: Request) {
  return checkRateLimit({
    req,
    route: "training",
    max: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_TRAINING_MAX, 20),
    windowMs: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000)
  });
}

export function resetRateLimitStore() {
  buckets.clear();
}

