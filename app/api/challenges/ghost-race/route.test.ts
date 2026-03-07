import { GET } from "@/app/api/challenges/ghost-race/route";
import { resetGhostRaceStore } from "@/lib/binary2048/ghost-race";

describe("GET /api/challenges/ghost-race", () => {
  beforeEach(() => resetGhostRaceStore());

  it("returns deterministic challenge payload", async () => {
    const res = await GET(new Request("http://localhost/api/challenges/ghost-race?seed=1234&maxMoves=120"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.challenge.challengeId).toBe("ghost_1234");
    expect(json.challenge.bot).toBe("rollout");
    expect(Array.isArray(json.challenge.ghost.moves)).toBe(true);
  });
});
