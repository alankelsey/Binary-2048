import { POST } from "@/app/api/bots/tournament/route";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import { acquireTournamentSlot, resetTournamentQueue } from "@/lib/binary2048/tournament-queue";

describe("POST /api/bots/tournament", () => {
  beforeEach(() => {
    resetRateLimitStore();
    resetTournamentQueue();
    delete process.env.BINARY2048_RATE_LIMIT_TOURNAMENT_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_WINDOW_MS;
    delete process.env.BINARY2048_TOURNAMENT_MAX_CONCURRENT;
    delete process.env.BINARY2048_TOURNAMENT_MAX_QUEUE;
    delete process.env.BINARY2048_TOURNAMENT_QUEUE_WAIT_TIMEOUT_MS;
    delete process.env.BINARY2048_CHALLENGE_MODE;
    delete process.env.BINARY2048_CHALLENGE_SECRET;
    delete process.env.BINARY2048_DEGRADE_MODE;
    delete process.env.BINARY2048_DEGRADE_DISABLE_TOURNAMENT;
  });

  it("runs default tournament payload", async () => {
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rulesetId).toBe("binary2048-v1");
    expect(Array.isArray(json.seeds)).toBe(true);
    expect(Array.isArray(json.bots)).toBe(true);
    expect(json.bots).toContain("rollout");
    expect(Array.isArray(json.ranking)).toBe(true);
    expect(Array.isArray(json.runs)).toBe(true);
    expect(json.runs.length).toBe(json.seeds.length * json.bots.length);
  });

  it("supports explicit seeds and bot subset", async () => {
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seeds: [501, 502],
        maxMoves: 30,
        bots: ["priority", "alternate"]
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.seeds).toEqual([501, 502]);
    expect(json.bots).toEqual(["priority", "alternate"]);
    expect(json.runs).toHaveLength(4);
  });

  it("returns 429 when tournament rate limit is exceeded for same ip", async () => {
    process.env.BINARY2048_RATE_LIMIT_TOURNAMENT_MAX = "1";
    process.env.BINARY2048_RATE_LIMIT_WINDOW_MS = "60000";
    const req1 = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify({})
    });
    const req2 = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify({})
    });

    const first = await POST(req1);
    const second = await POST(req2);
    const secondJson = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(secondJson.error).toBe("Rate limit exceeded");
    expect(secondJson.route).toBe("bots_tournament");
  });

  it("returns 503 when tournament queue is full", async () => {
    process.env.BINARY2048_TOURNAMENT_MAX_CONCURRENT = "1";
    process.env.BINARY2048_TOURNAMENT_MAX_QUEUE = "0";
    process.env.BINARY2048_TOURNAMENT_QUEUE_WAIT_TIMEOUT_MS = "60000";
    const slot = await acquireTournamentSlot({ maxConcurrent: 1, maxQueue: 0, waitTimeoutMs: 60000 });
    try {
      const req = new Request("http://localhost/api/bots/tournament", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "5.6.7.8" },
        body: JSON.stringify({})
      });
      const res = await POST(req);
      const json = await res.json();
      expect(res.status).toBe(503);
      expect(json.code).toBe("queue_full");
    } finally {
      slot.release();
    }
  });

  it("returns 403 when challenge is enforced and token is missing", async () => {
    process.env.BINARY2048_CHALLENGE_MODE = "enforce";
    process.env.BINARY2048_CHALLENGE_SECRET = "challenge-secret";
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toBe("Challenge required");
  });

  it("returns 400 when seedCount exceeds endpoint cap", async () => {
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seedCount: 101 })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.code).toBe("cost_cap_exceeded");
    expect(json.field).toBe("seedCount");
    expect(json.limit).toBe(100);
  });

  it("returns 400 when explicit seed list exceeds endpoint cap", async () => {
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seeds: Array.from({ length: 101 }, (_, i) => i + 1) })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.code).toBe("cost_cap_exceeded");
    expect(json.field).toBe("seeds");
    expect(json.limit).toBe(100);
  });

  it("returns 400 when maxMoves exceeds endpoint cap", async () => {
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxMoves: 2001 })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.code).toBe("cost_cap_exceeded");
    expect(json.field).toBe("maxMoves");
    expect(json.limit).toBe(2000);
  });

  it("returns 503 when degrade mode disables tournament endpoint", async () => {
    process.env.BINARY2048_DEGRADE_DISABLE_TOURNAMENT = "1";
    const req = new Request("http://localhost/api/bots/tournament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.code).toBe("degrade_mode");
    expect(json.route).toBe("bots_tournament");
  });
});
