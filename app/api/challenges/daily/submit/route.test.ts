import { POST } from "@/app/api/challenges/daily/submit/route";
import { getDailyChallenge, resetDailyChallengeStore } from "@/lib/binary2048/daily-challenge";
import { runScenario } from "@/lib/binary2048/engine";

describe("POST /api/challenges/daily/submit", () => {
  beforeEach(() => resetDailyChallengeStore());

  it("submits a replay into daily leaderboard", async () => {
    const challenge = getDailyChallenge();
    const replay = runScenario(challenge.config, challenge.initialGrid, ["left", "up", "right"]);
    const req = new Request("http://localhost/api/challenges/daily/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: "player_1",
        replay
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.submitted).toBe(true);
    expect(json.challengeId).toContain("daily_");
    expect(json.rank).toBe(1);
  });

  it("rejects request without replay payload", async () => {
    const req = new Request("http://localhost/api/challenges/daily/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: "player_1" })
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
