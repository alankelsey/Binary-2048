import { GET } from "@/app/api/matches/[id]/route";
import { createAsyncSameSeedMatch, resetAsyncMatches, submitAsyncMatchMoves } from "@/lib/binary2048/async-pvp";

describe("GET /api/matches/:id", () => {
  beforeEach(() => {
    resetAsyncMatches();
  });

  it("returns match and standings", async () => {
    const match = createAsyncSameSeedMatch({ createdBy: "a", opponentId: "b", seed: 111 });
    submitAsyncMatchMoves({ matchId: match.id, playerId: "a", moves: ["R"] });

    const res = await GET(new Request("http://localhost/api/matches/x"), {
      params: Promise.resolve({ id: match.id })
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.match.id).toBe(match.id);
    expect(json.standings).toHaveLength(1);
  });

  it("returns 404 for unknown id", async () => {
    const res = await GET(new Request("http://localhost/api/matches/missing"), {
      params: Promise.resolve({ id: "missing" })
    });
    expect(res.status).toBe(404);
  });
});
