import { stateHash } from "@/lib/binary2048/ai";
import { POST } from "@/app/api/games/[id]/move/route";
import {
  createSession,
  exportRecoverySnapshot,
  exportSession,
  getSession,
  importRecoveryPayload
} from "@/lib/binary2048/sessions";
import { resetRateLimitStore } from "@/lib/binary2048/rate-limit";
import { getOpsTelemetrySnapshot, resetOpsTelemetry } from "@/lib/binary2048/ops-telemetry";
import {
  installSessionStoreForTests,
  resetSessionStoreForTests,
  SessionConflictError,
  type SessionStore
} from "@/lib/binary2048/session-store";
import type { Cell, GameConfig } from "@/lib/binary2048/types";
import { resetMoveRuntimeTelemetryForTests } from "@/lib/binary2048/move-runtime-telemetry";

describe("POST /api/games/:id/move hash guard", () => {
  beforeEach(() => {
    resetRateLimitStore();
    resetSessionStoreForTests();
    resetOpsTelemetry();
    resetMoveRuntimeTelemetryForTests();
    delete process.env.BINARY2048_RATE_LIMIT_MOVE_MAX;
    delete process.env.BINARY2048_RATE_LIMIT_WINDOW_MS;
    delete process.env.BINARY2048_BOT_API_KEY_HASHES;
    delete process.env.BINARY2048_RECOVERY_SECRET;
    delete process.env.BINARY2048_SESSION_STORE;
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

  function serverTiming(res: Response) {
    const value = res.headers.get("server-timing") ?? "";
    const entries = value.split(",").map((part) => part.trim()).filter(Boolean);
    const names = entries.map((entry) => entry.split(";")[0]);
    for (const entry of entries) {
      expect(entry).toMatch(/^[a-z_]+;dur=\d+\.\d{2}$/);
      expect(Number(entry.match(/;dur=(\d+\.\d{2})$/)?.[1])).toBeGreaterThanOrEqual(0);
    }
    return { value, names };
  }

  function lastMoveTelemetry() {
    return getOpsTelemetrySnapshot().recentMoveTimings.at(-1);
  }

  const initialGrid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];

  it("returns 409 and does not mutate session when expectStateHash is stale", async () => {
    const session = (await createSession(config, initialGrid));
    const id = session.current.id;
    const before = (await getSession(id));
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
    expect((await getSession(id))?.steps.length).toBe(0);
  });

  it("accepts move when expectStateHash matches current state", async () => {
    const session = (await createSession(config, initialGrid));
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
    expect((await getSession(id))?.steps.length).toBe(1);
    expect(res.headers.get("ratelimit-limit")).toBe("600");
    expect(res.headers.get("ratelimit-remaining")).toBe("599");
    expect(res.headers.get("ratelimit-reset")).toMatch(/^\d+$/);
    expect(res.headers.get("ratelimit-scope")).toBe("ip");
    expect(res.headers.get("ratelimit-tier")).toBe("guest");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const timing = serverTiming(res);
    expect(timing.names).toEqual(expect.arrayContaining([
      "rate_limit_identity",
      "rate_limit_counter",
      "request_parse",
      "session_lookup",
      "engine_move",
      "session_persist",
      "snapshot_build",
      "response_encode",
      "total"
    ]));
    expect(timing.value).not.toContain(id);
    expect(lastMoveTelemetry()).toMatchObject({ status: 200, sessionPath: "resident_memory", rateLimitBackend: "memory" });
    expect(lastMoveTelemetry()?.runtime).toMatchObject({
      schemaVersion: 1,
      observation: "first_observed",
      requestOrdinal: 1,
      memory: { monitor: "available" },
      workload: { monitor: "instrumented_move_route_only", movesInFlightAtStart: 1, movesInFlightAtEnd: 0 }
    });
    expect(timing.value).not.toContain(lastMoveTelemetry()?.runtime?.runtimeId);
  });

  it("returns 400 when neither dir nor action is provided", async () => {
    const session = (await createSession(config, initialGrid));
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
    expect(serverTiming(res).names).toEqual([
      "rate_limit_identity",
      "rate_limit_counter",
      "request_parse",
      "response_encode",
      "total"
    ]);
    expect(lastMoveTelemetry()?.sessionPath).toBe("not_checked");
  });

  it("returns 404 for missing game id", async () => {
    const get = jest.fn().mockResolvedValue(null);
    installSessionStoreForTests({
      get,
      set: jest.fn(),
      delete: jest.fn()
    } as SessionStore);
    const req = new Request("http://localhost/api/games/x/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "L" })
    });
    const res = await POST(req, { params: Promise.resolve({ id: "missing_game" }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Game not found");
    expect(serverTiming(res).names).toEqual(expect.arrayContaining(["session_lookup", "total"]));
    expect(lastMoveTelemetry()?.sessionPath).toBe("missing");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["without recovery", undefined],
    ["with recovery", { recoveryVersion: 1 }]
  ])("returns 503 when session lookup storage is unavailable %s", async (_label, recoverySnapshot) => {
    installSessionStoreForTests({
      get: jest.fn().mockRejectedValue(new Error("database details must stay private")),
      set: jest.fn(),
      delete: jest.fn()
    } as SessionStore);
    const res = await POST(
      new Request("http://localhost/api/games/x/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "L", recoverySnapshot })
      }),
      { params: Promise.resolve({ id: "unavailable_game" }) }
    );
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe("Session storage is temporarily unavailable");
    expect(JSON.stringify(json)).not.toContain("database details");
    expect(serverTiming(res).names).toEqual(expect.arrayContaining(["session_lookup", "total"]));
    expect(serverTiming(res).names).not.toContain("engine_move");
  });

  it.each([
    ["conflict", new SessionConflictError(), 409, "Session changed; refresh and retry"],
    ["unavailable", new Error("private storage failure"), 503, "Session storage is temporarily unavailable"]
  ])("reports failed move persistence as %s", async (_label, failure, expectedStatus, expectedMessage) => {
    const session = (await createSession(config, initialGrid));
    const id = session.current.id;
    const stored = structuredClone(session);
    installSessionStoreForTests({
      get: jest.fn().mockResolvedValue(stored),
      set: jest.fn().mockRejectedValue(failure),
      delete: jest.fn()
    } as SessionStore);

    const res = await POST(
      new Request("http://localhost/api/games/x/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "L" })
      }),
      { params: Promise.resolve({ id }) }
    );
    const json = await res.json();

    expect(res.status).toBe(expectedStatus);
    expect(json.error).toBe(expectedMessage);
    expect(serverTiming(res).names).toEqual(expect.arrayContaining(["engine_move", "session_persist", "total"]));
    expect(lastMoveTelemetry()?.timingsMs.session_persist).toBeGreaterThanOrEqual(0);
    expect(session.steps).toHaveLength(0);
  });

  it("atomically recovers a missing instance-local session and applies the move", async () => {
    const original = (await createSession(config, initialGrid));
    const recoverySnapshot = (await exportRecoverySnapshot(original.current.id));
    const req = new Request("http://localhost/api/games/missing_game/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "L", recoverySnapshot })
    });
    const res = await POST(req, { params: Promise.resolve({ id: "missing_game" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).not.toBe("missing_game");
    expect(json.current.turn).toBe(1);
    expect(json.current.score).toBe(2);
    expect(json.recoverySnapshot).toMatchObject({ recoveryVersion: 1, moves: ["left"] });
    expect((await getSession(json.id))?.steps).toHaveLength(1);
    expect(serverTiming(res).names).toEqual(expect.arrayContaining([
      "session_lookup",
      "recovery_verify",
      "recovery_replay",
      "recovery_import",
      "engine_move",
      "session_persist"
    ]));
    expect(lastMoveTelemetry()?.sessionPath).toBe("recovery_snapshot");
  });

  it("accepts the legacy full browser snapshot during rollout", async () => {
    const original = (await createSession(config, initialGrid));
    const recoverySnapshot = (await exportSession(original.current.id));
    const req = new Request("http://localhost/api/games/missing_game/move", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "L", recoverySnapshot })
    });
    const res = await POST(req, { params: Promise.resolve({ id: "missing_game" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.current.turn).toBe(1);
    expect(json.recoverySnapshot).toMatchObject({ recoveryVersion: 1, moves: ["left"] });
    expect(lastMoveTelemetry()?.sessionPath).toBe("legacy_export");
  });

  it("prefers a newer signed browser snapshot over a stale instance-local session", async () => {
    process.env.BINARY2048_RECOVERY_SECRET = "move-recovery-secret";
    const original = (await createSession(config, initialGrid));
    const id = original.current.id;
    const initialSnapshot = (await exportRecoverySnapshot(id));
    const firstMove = await POST(
      new Request("http://localhost/api/games/x/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: "left" })
      }),
      { params: Promise.resolve({ id }) }
    );
    const firstJson = await firstMove.json();
    expect(firstJson.recoverySnapshot.moves).toEqual(["left"]);
    const signedTiming = serverTiming(firstMove);
    expect(signedTiming.names).toContain("snapshot_sign");
    expect(signedTiming.value).not.toContain("move-recovery-secret");
    expect(signedTiming.value).not.toContain(firstJson.recoverySnapshot.signature);

    resetSessionStoreForTests();
    (await importRecoveryPayload(initialSnapshot!));
    expect((await getSession(id))?.steps).toHaveLength(0);

    const resumed = await POST(
      new Request("http://localhost/api/games/x/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: "down", recoverySnapshot: firstJson.recoverySnapshot })
      }),
      { params: Promise.resolve({ id }) }
    );
    const resumedJson = await resumed.json();

    expect(resumed.status).toBe(200);
    expect(resumedJson.id).toBe(id);
    expect(resumedJson.recoverySnapshot.moves).toEqual(["left", "down"]);
    expect((await getSession(id))?.steps.map((step) => step.dir)).toEqual(["left", "down"]);
  });

  it("returns 429 without mutating the game when the move quota is exhausted", async () => {
    process.env.BINARY2048_RATE_LIMIT_MOVE_MAX = "1";
    process.env.BINARY2048_RATE_LIMIT_WINDOW_MS = "60000";
    const session = (await createSession(config, initialGrid));
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
    expect((await getSession(id))?.steps.length).toBe(1);
    expect(serverTiming(second).names).toEqual([
      "rate_limit_identity",
      "rate_limit_counter",
      "response_encode",
      "total"
    ]);
    expect(lastMoveTelemetry()).toMatchObject({ status: 429, sessionPath: "not_checked" });
  });
});
