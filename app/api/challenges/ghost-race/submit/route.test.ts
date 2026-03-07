import { POST } from "@/app/api/challenges/ghost-race/submit/route";
import { buildGhostRaceChallenge, resetGhostRaceStore } from "@/lib/binary2048/ghost-race";
import { runScenario } from "@/lib/binary2048/engine";

describe("POST /api/challenges/ghost-race/submit", () => {
  beforeEach(() => resetGhostRaceStore());

  it("submits replay and returns ghost race result", async () => {
    const challenge = buildGhostRaceChallenge(7001, 100);
    const replay = runScenario(challenge.config, challenge.initialGrid, ["left", "up", "right"]);
    const req = new Request("http://localhost/api/challenges/ghost-race/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: "player_1", replay })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.submitted).toBe(true);
    expect(json.result.challengeId).toBe("ghost_7001");
  });

  it("rejects missing replay payload", async () => {
    const req = new Request("http://localhost/api/challenges/ghost-race/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: "player_1" })
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
