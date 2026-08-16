import { GET } from "@/app/api/training/replays/route";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import { acquireTrainingSlot, resetTrainingQueue } from "@/lib/binary2048/training-queue";

describe("GET /api/training/replays", () => {
  beforeEach(() => {
    resetRateLimitStore();
    resetTrainingQueue();
    delete process.env.BINARY2048_CHALLENGE_MODE;
    delete process.env.BINARY2048_RATE_LIMIT_TRAINING_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_WINDOW_MS;
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
    delete process.env.BINARY2048_TRAINING_MAX_CONCURRENT;
    delete process.env.BINARY2048_TRAINING_MAX_QUEUE;
    delete process.env.BINARY2048_TRAINING_QUEUE_WAIT_TIMEOUT_MS;
  });

  it("publishes quota headers on success and Retry-After on 429", async () => {
    process.env.BINARY2048_RATE_LIMIT_TRAINING_MAX = "1";
    const url = "http://localhost/api/training/replays?page=1&limit=1&bot=priority";
    const first = await GET(new Request(url, { headers: { "x-forwarded-for": "10.2.0.1" } }));
    const second = await GET(new Request(url, { headers: { "x-forwarded-for": "10.2.0.1" } }));
    expect(first.status).toBe(200);
    expect(first.headers.get("ratelimit-limit")).toBe("1");
    expect(first.headers.get("ratelimit-remaining")).toBe("0");
    expect(first.headers.get("ratelimit-reset")).toMatch(/^\d+$/);
    expect(first.headers.get("retry-after")).toBeNull();
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("returns 503 when the separate training pool is saturated", async () => {
    process.env.BINARY2048_TRAINING_MAX_CONCURRENT = "1";
    process.env.BINARY2048_TRAINING_MAX_QUEUE = "0";
    const slot = await acquireTrainingSlot({ maxConcurrent: 1, maxQueue: 0, waitTimeoutMs: 1000 });
    try {
      const response = await GET(new Request(
        "http://localhost/api/training/replays?page=1&limit=1&bot=priority",
        { headers: { "x-forwarded-for": "10.2.0.3" } }
      ));
      const json = await response.json();
      expect(response.status).toBe(503);
      expect(json.code).toBe("queue_full");
      expect(response.headers.get("retry-after")).toBe("5");
    } finally {
      slot.release();
    }
  });
});
