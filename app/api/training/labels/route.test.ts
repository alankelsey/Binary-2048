import { GET } from "@/app/api/training/labels/route";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import { resetTrainingQueue } from "@/lib/binary2048/training-queue";

describe("GET /api/training/labels", () => {
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

  it("publishes quota headers on success", async () => {
    const response = await GET(new Request(
      "http://localhost/api/training/labels?page=1&limit=1&strategy=score_delta",
      { headers: { "x-forwarded-for": "10.2.0.2" } }
    ));
    expect(response.status).toBe(200);
    expect(response.headers.get("ratelimit-limit")).toBe("20");
    expect(response.headers.get("ratelimit-remaining")).toBe("19");
    expect(response.headers.get("ratelimit-reset")).toMatch(/^\d+$/);
    const json = await response.json();
    expect(json.queue).toEqual({ active: 1, queued: 0 });
  });
});
