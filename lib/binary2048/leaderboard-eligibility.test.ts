import { getLeaderboardEligibility } from "@/lib/binary2048/leaderboard";
import { createSession, moveSession, undoSession } from "@/lib/binary2048/sessions";
import type { Cell } from "@/lib/binary2048/types";

describe("leaderboard eligibility", () => {
  function finishRankedSession(seed: number, overrides?: {
    spawn?: { pZero?: number; pOne?: number; pWildcard?: number; pLock?: number; wildcardMultipliers?: number[] };
    initialGrid?: Cell[][];
  }) {
    const defaultGrid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const session = createSession(
      {
        seed,
        winTile: 2,
        spawn: {
          pZero: overrides?.spawn?.pZero ?? 0.15,
          pOne: overrides?.spawn?.pOne ?? 0.72,
          pWildcard: overrides?.spawn?.pWildcard ?? 0.1,
          pLock: overrides?.spawn?.pLock ?? 0.03,
          wildcardMultipliers: overrides?.spawn?.wildcardMultipliers ?? [2, 4, 8]
        }
      },
      overrides?.initialGrid ?? defaultGrid,
      { sessionClass: "ranked" }
    );
    moveSession(session.current.id, "left");
    return session;
  }

  it("marks default ranked runs as pure and eligible", () => {
    const session = finishRankedSession(7001);
    const result = getLeaderboardEligibility(session);
    expect(result.eligible).toBe(true);
    expect(result.bracket).toBe("ranked_pure");
  });

  it("marks seeded-start grids as boosted", () => {
    const seededGrid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, { t: "n", v: 2 }, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const session = finishRankedSession(7003, { initialGrid: seededGrid });
    const result = getLeaderboardEligibility(session);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Seeded starts");
  });

  it("marks undo-assisted ranked runs as boosted", async () => {
    const session = finishRankedSession(7004);
    undoSession(session.current.id);
    moveSession(session.current.id, "left");
    const latest = getLeaderboardEligibility(session);
    expect(latest.eligible).toBe(false);
    expect(latest.reason).toContain("Undo-assisted");
  });
});
