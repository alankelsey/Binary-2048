import { stateHash } from "@/lib/binary2048/ai";
import { POST } from "@/app/api/games/[id]/move/route";
import { createSession, getSession } from "@/lib/binary2048/sessions";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

describe("POST /api/games/:id/move hash guard", () => {
  beforeEach(() => {
    resetRateLimitStore();
    delete process.env.BINARY2048_RATE_LIMIT_MOVE_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_WINDOW_MS;
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
  });

  const config: Partial<GameConfig> = {
    width: 4,
    height: 4,
    seed: 909,
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

  it("returns 409 and does not mutate session when expectStateHash is stale", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const before = getSession(id);
    expect(before?.steps.length).toBe(0);

    const req = new Request("http://localhost/api/games/x/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "L", expectStateHash: "deadbeef" })
    });
    const res = await POST(req, { params: Promise.resolve({ id }) });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("State hash mismatch");
    expect(typeof json.actual).toBe("string");
    expect(getSession(id)?.steps.length).toBe(0);
  });

  it("accepts move when expectStateHash matches current state", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const expected = stateHash(session.current);

    const req = new Request("http://localhost/api/games/x/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "L", expectStateHash: expected })
    });
    const res = await POST(req, { params: Promise.resolve({ id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.action).toBe("L");
    expect(json.dir).toBe("left");
    expect(json.stepCount).toBe(1);
    expect(typeof json.stateHash).toBe("string");
    expect(json.integrity?.sessionClass).toBe("unranked");
    expect(json.economy?.canContinueAfterWin).toBe(true);
    expect(getSession(id)?.steps.length).toBe(1);
    expect(res.headers.get("ratelimit-limit")).toBe("600");
    expect(res.headers.get("ratelimit-remaining")).toBe("599");
    expect(res.headers.get("ratelimit-reset")).toMatch(/^\d+$/);
  });

  it("returns 400 when neither dir nor action is provided", async () => {
    const session = createSession(config, initialGrid);
    const id = session.current.id;

    const req = new Request("http://localhost/api/games/x/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await POST(req, { params: Promise.resolve({ id }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("dir or action is required");
  });

  it("returns 404 for missing game id", async () => {
    const req = new Request("http://localhost/api/games/x/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "L" })
    });
    const res = await POST(req, { params: Promise.resolve({ id: "missing_game" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Game not found");
  });

  it("returns 429 without mutating the game when the move quota is exhausted", async () => {
    process.env.BINARY2048_RATE_LIMIT_MOVE_MAX = "1";
    process.env.BINARY2048_RATE_LIMIT_WINDOW_MS = "60000";
    const session = createSession(config, initialGrid);
    const id = session.current.id;
    const makeRequest = () =>
      new Request("http://localhost/api/games/x/move", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.3.0.1" },
        body: JSON.stringify({ action: "L" })
      });

    const first = await POST(makeRequest(), { params: Promise.resolve({ id }) });
    const second = await POST(makeRequest(), { params: Promise.resolve({ id }) });
    const secondJson = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(secondJson.route).toBe("game_move");
    expect(second.headers.get("ratelimit-limit")).toBe("1");
    expect(second.headers.get("ratelimit-remaining")).toBe("0");
    expect(second.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(getSession(id)?.steps.length).toBe(1);
  });
});
