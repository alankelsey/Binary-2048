import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { POST } from "@/app/api/leaderboard/submit/route";
import { resetLeaderboard } from "@/lib/binary2048/leaderboard";
import { getRunStore, resetRunStoreForTests } from "@/lib/binary2048/run-store";
import { createSession, moveSession, undoSession } from "@/lib/binary2048/sessions";
import type { Cell } from "@/lib/binary2048/types";

function authHeader(sub = "u_ranked", tier: "guest" | "authed" | "paid" = "authed") {
  const secret = process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? "";
  const token = createAuthBridgeToken(
    {
      sub,
      tier,
      exp: Math.floor(Date.now() / 1000) + 60
    },
    secret
  );
  return { authorization: `Bearer ${token}` };
}

function createFinishedRankedGame() {
  const grid: Cell[][] = [
    [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];
  const session = createSession(
    {
      seed: 601,
      winTile: 2,
      spawn: { pZero: 0, pOne: 0.9, pWildcard: 0.1, pLock: 0, wildcardMultipliers: [2] }
    },
    grid,
    { sessionClass: "ranked" }
  );
  moveSession(session.current.id, "left");
  return session.current.id;
}

describe("POST /api/leaderboard/submit", () => {
  beforeEach(() => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "leaderboard-submit-secret";
  });

  afterEach(() => {
    resetLeaderboard();
    resetRunStoreForTests();
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
    delete process.env.BINARY2048_REPLAY_CODE_SECRET;
  });

  it("rejects unauthenticated submissions", async () => {
    const req = new Request("http://localhost/api/leaderboard/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId: "g_missing" })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("submits completed ranked game using server-derived score", async () => {
    const gameId = createFinishedRankedGame();

    const req = new Request("http://localhost/api/leaderboard/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeader("u_submitter", "authed")
      },
      body: JSON.stringify({ gameId })
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.submitted).toBe(true);
    expect(json.rank).toBe(1);
    expect(json.entry?.gameId).toBe(gameId);
    expect(json.entry?.playerId).toBe("u_submitter");
    expect(typeof json.entry?.score).toBe("number");
    const stored = await getRunStore().getRun(`run_${gameId}`);
    expect(stored?.gameId).toBe(gameId);
    expect(stored?.playerId).toBe("u_submitter");
    expect(Array.isArray(stored?.replay.moves)).toBe(true);
  });

  it("stores replay signature when replay signing secret is configured", async () => {
    process.env.BINARY2048_REPLAY_CODE_SECRET = "leaderboard-replay-sign";
    const gameId = createFinishedRankedGame();
    const req = new Request("http://localhost/api/leaderboard/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeader("u_submitter", "authed")
      },
      body: JSON.stringify({ gameId })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(typeof json.entry?.replaySignature).toBe("string");
  });

  it("rejects unranked game submissions", async () => {
    const grid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const unranked = createSession(
      {
        seed: 602,
        winTile: 2,
        spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] }
      },
      grid
    );
    moveSession(unranked.current.id, "left");

    const req = new Request("http://localhost/api/leaderboard/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeader("u_submitter", "authed")
      },
      body: JSON.stringify({ gameId: unranked.current.id })
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects boosted ranked runs (seeded start grid)", async () => {
    const grid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, { t: "n", v: 2 }, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const boosted = createSession(
      {
        seed: 604,
        winTile: 2,
        spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2, 4, 8] }
      },
      grid,
      { sessionClass: "ranked" }
    );
    moveSession(boosted.current.id, "left");

    const req = new Request("http://localhost/api/leaderboard/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeader("u_submitter", "authed")
      },
      body: JSON.stringify({ gameId: boosted.current.id })
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(String(json.error)).toContain("Seeded starts");
    expect(json.bracket).toBe("ranked_boosted");
  });

  it("rejects undo-assisted ranked runs", async () => {
    const gameId = createFinishedRankedGame();
    undoSession(gameId);
    moveSession(gameId, "left");

    const req = new Request("http://localhost/api/leaderboard/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeader("u_submitter", "authed")
      },
      body: JSON.stringify({ gameId })
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(String(json.error)).toContain("Undo-assisted");
    expect(json.bracket).toBe("ranked_boosted");
  });

  it("rejects active ranked game submissions", async () => {
    const grid: Cell[][] = [
      [{ t: "n", v: 1 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const ranked = createSession({ seed: 603 }, grid, { sessionClass: "ranked" });

    const req = new Request("http://localhost/api/leaderboard/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeader("u_submitter", "authed")
      },
      body: JSON.stringify({ gameId: ranked.current.id })
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
