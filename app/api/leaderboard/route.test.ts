import { GET } from "@/app/api/leaderboard/route";
import { resetLeaderboard, submitLeaderboardEntry } from "@/lib/binary2048/leaderboard";
import { createSession, moveSession } from "@/lib/binary2048/sessions";
import type { Cell } from "@/lib/binary2048/types";

describe("GET /api/leaderboard", () => {
  afterEach(() => {
    resetLeaderboard();
  });

  it("returns sorted leaderboard entries and applies limit", async () => {
    const lowGrid: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "n", v: 2 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const highGrid: Cell[][] = [
      [{ t: "n", v: 4 }, { t: "n", v: 4 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const low = createSession({ seed: 501, spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } }, lowGrid, { sessionClass: "ranked" });
    moveSession(low.current.id, "left");
    const high = createSession({ seed: 502, spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } }, highGrid, { sessionClass: "ranked" });
    moveSession(high.current.id, "left");

    submitLeaderboardEntry({ playerId: "u_low", userTier: "authed", gameId: low.current.id, session: low });
    submitLeaderboardEntry({ playerId: "u_high", userTier: "paid", gameId: high.current.id, session: high });

    const req = new Request("http://localhost/api/leaderboard?limit=1");
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.limit).toBe(1);
    expect(Array.isArray(json.entries)).toBe(true);
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0]?.playerId).toBe("u_high");
  });
});
