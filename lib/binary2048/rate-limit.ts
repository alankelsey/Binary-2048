import { resolveBotApiKey } from "@/lib/binary2048/bot-api-key";
import { MongoClient, type Collection } from "mongodb";

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

export type RateLimitResult = {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAtEpochSeconds: number;
  backend: "memory" | "mongo" | "memory_fallback";
};

type CounterResult = { count: number; resetAt: number };

type RateLimitCounterStore = {
  consume: (key: string, windowMs: number, now: number) => Promise<CounterResult>;
};

type MongoRateLimitDocument = {
  _id: string;
  count: number;
  resetAt: Date;
  expiresAt: Date;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_rate_limit_buckets?: Map<string, RateLimitBucket>;
  __binary2048_rate_limit_mongo_collection?: Promise<Collection<MongoRateLimitDocument>>;
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
  const apiKeyIdentity = resolveBotApiKey(req.headers.get("x-api-key"));
  if (apiKeyIdentity) return `key:${apiKeyIdentity.id}`;

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor && forwardedFor.trim().length > 0) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return `ip:${ip}`;
  }
  return "ip:unknown";
}

const memoryCounterStore: RateLimitCounterStore = {
  async consume(key, windowMs, now) {
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }
    existing.count += 1;
    buckets.set(key, existing);
    return { count: existing.count, resetAt: existing.resetAt };
  }
};

async function getMongoCollection() {
  if (!globalStore.__binary2048_rate_limit_mongo_collection) {
    const pending = (async () => {
      const uri = process.env.BINARY2048_MONGO_URI ?? "";
      if (!uri) throw new Error("BINARY2048_MONGO_URI is required when BINARY2048_RATE_LIMIT_STORE=mongo");
      const timeoutMs = parsePositiveInt(process.env.BINARY2048_MONGO_RATE_LIMIT_TIMEOUT_MS, 3000);
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: timeoutMs,
        connectTimeoutMS: timeoutMs,
        maxPoolSize: 5
      });
      await client.connect();
      const collection = client
        .db(process.env.BINARY2048_MONGO_DB ?? "binary2048")
        .collection<MongoRateLimitDocument>(process.env.BINARY2048_MONGO_RATE_LIMIT_COLLECTION ?? "rate_limits");
      await collection.createIndex({ expiresAt: 1 }, { name: "rate_limit_ttl", expireAfterSeconds: 0 });
      return collection;
    })();
    globalStore.__binary2048_rate_limit_mongo_collection = pending.catch((error) => {
      delete globalStore.__binary2048_rate_limit_mongo_collection;
      throw error;
    });
  }
  return globalStore.__binary2048_rate_limit_mongo_collection;
}

const mongoCounterStore: RateLimitCounterStore = {
  async consume(key, windowMs, now) {
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;
    const collection = await getMongoCollection();
    const document = await collection.findOneAndUpdate(
      { _id: `${key}:${windowStart}` },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          resetAt: new Date(resetAt),
          expiresAt: new Date(resetAt + windowMs)
        }
      },
      { upsert: true, returnDocument: "after" }
    );
    if (!document) throw new Error("Mongo rate-limit counter update returned no document");
    return { count: document.count, resetAt: document.resetAt.getTime() };
  }
};

export async function checkRateLimit(input: CheckRateLimitInput): Promise<RateLimitResult> {
  const now = Date.now();
  const key = `${input.route}:${getClientIdentifier(input.req)}`;
  const windowMs = Math.max(1000, input.windowMs);
  const limit = Math.max(1, input.max);
  const useMongo = (process.env.BINARY2048_RATE_LIMIT_STORE ?? "memory").toLowerCase() === "mongo";
  let backend: RateLimitResult["backend"] = useMongo ? "mongo" : "memory";
  let counter: CounterResult;
  try {
    counter = await (useMongo ? mongoCounterStore : memoryCounterStore).consume(key, windowMs, now);
  } catch (error) {
    if (!useMongo) throw error;
    backend = "memory_fallback";
    counter = await memoryCounterStore.consume(key, windowMs, now);
    const failure = error as { name?: unknown; code?: unknown };
    console.error("Mongo rate-limit store unavailable; using per-instance fallback", {
      errorName: typeof failure?.name === "string" ? failure.name : "unknown",
      errorCode: typeof failure?.code === "string" || typeof failure?.code === "number" ? failure.code : "unknown"
    });
  }
  const remaining = Math.max(0, limit - counter.count);
  return {
    allowed: counter.count <= limit,
    key,
    limit,
    remaining,
    retryAfterSeconds: Math.max(1, Math.ceil((counter.resetAt - now) / 1000)),
    resetAtEpochSeconds: Math.ceil(counter.resetAt / 1000),
    backend
  };
}

export function rateLimitHeaders(quota: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(quota.limit),
    "RateLimit-Remaining": String(quota.remaining),
    "RateLimit-Reset": String(quota.resetAtEpochSeconds)
  };
  if (!quota.allowed) headers["Retry-After"] = String(quota.retryAfterSeconds);
  return headers;
}

export async function checkTournamentRateLimit(req: Request) {
  return checkRateLimit({
    req,
    route: "bots_tournament",
    max: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_TOURNAMENT_MAX, 10),
    windowMs: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000)
  });
}

export async function checkSimulateRateLimit(req: Request) {
  return checkRateLimit({
    req,
    route: "simulate",
    max: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_SIMULATE_MAX, 60),
    windowMs: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000)
  });
}

export async function checkMoveRateLimit(req: Request) {
  return checkRateLimit({
    req,
    route: "game_move",
    max: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_MOVE_MAX, 600),
    windowMs: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000)
  });
}

export async function checkTrainingRateLimit(req: Request) {
  return checkRateLimit({
    req,
    route: "training",
    max: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_TRAINING_MAX, 20),
    windowMs: parsePositiveInt(process.env.BINARY2048_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000)
  });
}

export function resetRateLimitStore() {
  buckets.clear();
  delete globalStore.__binary2048_rate_limit_mongo_collection;
}
