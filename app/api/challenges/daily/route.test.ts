import { GET } from "@/app/api/challenges/daily/route";
import { resetDailyChallengeStore } from "@/lib/binary2048/daily-challenge";

describe("GET /api/challenges/daily", () => {
  beforeEach(() => resetDailyChallengeStore());

  it("returns challenge metadata and leaderboard", async () => {
    const res = await GET(new Request("http://localhost/api/challenges/daily?limit=5"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.challenge.mode).toBe("bitstorm_daily");
    expect(Array.isArray(json.leaderboard)).toBe(true);
    expect(json.limit).toBe(5);
  });
});
