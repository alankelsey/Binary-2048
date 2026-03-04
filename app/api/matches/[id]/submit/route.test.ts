import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { createAsyncSameSeedMatch, resetAsyncMatches } from "@/lib/binary2048/async-pvp";
import { POST } from "@/app/api/matches/[id]/submit/route";

describe("POST /api/matches/:id/submit", () => {
  beforeEach(() => {
    resetAsyncMatches();
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("submits a player's moves and returns standing", async () => {
    const match = createAsyncSameSeedMatch({ createdBy: "a", opponentId: "b", seed: 1000 });

    const res = await POST(
      new Request("http://localhost/api/matches/x/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: "a", moves: ["L", "U", "R"] })
      }),
      { params: Promise.resolve({ id: match.id }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.submission.playerId).toBe("a");
    expect(json.standings).toHaveLength(1);
  });

  it("uses auth claims sub when playerId omitted", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "submit-auth-secret";
    const token = createAuthBridgeToken(
      {
        sub: "auth-a",
        exp: Math.floor(Date.now() / 1000) + 120,
        tier: "authed"
      },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET
    );

    const match = createAsyncSameSeedMatch({ createdBy: "auth-a", opponentId: "b", seed: 1001 });

    const res = await POST(
      new Request("http://localhost/api/matches/x/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ moves: ["D", "D"] })
      }),
      { params: Promise.resolve({ id: match.id }) }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.submission.playerId).toBe("auth-a");
  });

  it("returns 404 for missing match", async () => {
    const res = await POST(
      new Request("http://localhost/api/matches/missing/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: "a", moves: ["L"] })
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid moves", async () => {
    const match = createAsyncSameSeedMatch({ createdBy: "a", opponentId: "b", seed: 77 });
    const res = await POST(
      new Request("http://localhost/api/matches/x/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId: "a", moves: ["BAD"] })
      }),
      { params: Promise.resolve({ id: match.id }) }
    );
    expect(res.status).toBe(400);
  });
});
