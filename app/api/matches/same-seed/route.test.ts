import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { resetAsyncMatches } from "@/lib/binary2048/async-pvp";
import { POST } from "@/app/api/matches/same-seed/route";

describe("POST /api/matches/same-seed", () => {
  beforeEach(() => {
    resetAsyncMatches();
    delete process.env.BINARY2048_AUTH_BRIDGE_SECRET;
  });

  it("creates a match from payload", async () => {
    const res = await POST(
      new Request("http://localhost/api/matches/same-seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ createdBy: "u1", opponentId: "u2", seed: 123 })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.match.id).toBe("m_1");
    expect(json.match.players).toEqual(["u1", "u2"]);
    expect(json.standings).toEqual([]);
  });

  it("uses auth claims sub when createdBy is omitted", async () => {
    process.env.BINARY2048_AUTH_BRIDGE_SECRET = "match-auth-secret";
    const token = createAuthBridgeToken(
      {
        sub: "auth-player",
        exp: Math.floor(Date.now() / 1000) + 120,
        tier: "authed"
      },
      process.env.BINARY2048_AUTH_BRIDGE_SECRET
    );

    const res = await POST(
      new Request("http://localhost/api/matches/same-seed", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ opponentId: "peer" })
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.match.createdBy).toBe("auth-player");
    expect(json.match.players).toEqual(["auth-player", "peer"]);
  });
});
