import {
  asyncMatchStandings,
  createAsyncSameSeedMatch,
  getAsyncMatch,
  resetAsyncMatches,
  submitAsyncMatchMoves
} from "@/lib/binary2048/async-pvp";

describe("async same-seed pvp", () => {
  beforeEach(() => {
    resetAsyncMatches();
  });

  it("creates a match and returns it by id", () => {
    const match = createAsyncSameSeedMatch({ createdBy: "p1", opponentId: "p2", seed: 7001 });
    expect(match.id).toBe("m_1");
    expect(match.players).toEqual(["p1", "p2"]);
    expect(match.seed).toBe(7001);
    expect(match.status).toBe("open");
    expect(match.initialGrid.flat().filter(Boolean).length).toBe(2);

    const found = getAsyncMatch(match.id);
    expect(found?.id).toBe(match.id);
  });

  it("submits both players and computes complete standings", () => {
    const match = createAsyncSameSeedMatch({ createdBy: "a", opponentId: "b", seed: 42 });

    const first = submitAsyncMatchMoves({
      matchId: match.id,
      playerId: "a",
      moves: ["R", "U", "L", "D"]
    });
    expect(first.match.status).toBe("open");
    expect(first.submission.movesApplied).toBeGreaterThan(0);

    const second = submitAsyncMatchMoves({
      matchId: match.id,
      playerId: "b",
      moves: ["U", "U", "R", "R"]
    });
    expect(second.match.status).toBe("complete");

    const standings = asyncMatchStandings(second.match);
    expect(standings).toHaveLength(2);
    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(2);
  });

  it("rejects duplicate submit and non-member submit", () => {
    const match = createAsyncSameSeedMatch({ createdBy: "owner", opponentId: "peer", seed: 55 });

    submitAsyncMatchMoves({
      matchId: match.id,
      playerId: "owner",
      moves: ["L"]
    });

    expect(() =>
      submitAsyncMatchMoves({
        matchId: match.id,
        playerId: "owner",
        moves: ["R"]
      })
    ).toThrow("Player has already submitted this match");

    expect(() =>
      submitAsyncMatchMoves({
        matchId: match.id,
        playerId: "outsider",
        moves: ["L"]
      })
    ).toThrow("Player is not part of this match");
  });
});
