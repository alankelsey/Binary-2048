import { GET } from "@/app/api/runs/[id]/route";
import { getRunStore, resetRunStoreForTests } from "@/lib/binary2048/run-store";

describe("GET /api/runs/[id]", () => {
  beforeEach(() => {
    resetRunStoreForTests();
  });

  it("returns persisted run by id", async () => {
    await getRunStore().upsertRun({
      id: "run_abc",
      playerId: "u1",
      userTier: "authed",
      gameId: "g_1",
      score: 42,
      maxTile: 8,
      moves: 9,
      seed: 777,
      engineVersion: "test",
      rulesetId: "binary2048-v1",
      integrity: { sessionClass: "ranked", source: "created" },
      createdAtISO: new Date().toISOString(),
      replay: {
        header: {
          replayVersion: 1,
          rulesetId: "binary2048-v1",
          engineVersion: "test",
          size: 4,
          seed: 777,
          createdAt: new Date().toISOString()
        },
        config: {
          width: 4,
          height: 4,
          seed: 777,
          winTile: 2048,
          zeroBehavior: "annihilate",
          spawnOnNoopMove: false,
          spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2, 4] }
        },
        initialGrid: Array.from({ length: 4 }, () => [null, null, null, null]),
        moves: ["L"]
      }
    });
    const res = await GET(new Request("http://localhost/api/runs/run_abc"), {
      params: Promise.resolve({ id: "run_abc" })
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.id).toBe("run_abc");
    expect(json.score).toBe(42);
  });

  it("returns 404 when run missing", async () => {
    const res = await GET(new Request("http://localhost/api/runs/run_missing"), {
      params: Promise.resolve({ id: "run_missing" })
    });
    expect(res.status).toBe(404);
  });
});
