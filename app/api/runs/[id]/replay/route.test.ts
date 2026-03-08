import { GET } from "@/app/api/runs/[id]/replay/route";
import type { CompactReplayPayload } from "@/lib/binary2048/replay-format";
import { getRunStore, resetRunStoreForTests } from "@/lib/binary2048/run-store";

describe("GET /api/runs/[id]/replay", () => {
  beforeEach(() => {
    resetRunStoreForTests();
  });

  it("returns replay payload for stored run", async () => {
    const replay: CompactReplayPayload = {
      header: {
        replayVersion: 1 as const,
        rulesetId: "binary2048-v1",
        engineVersion: "test",
        size: 4,
        seed: 501,
        createdAt: new Date().toISOString()
      },
      config: {
        width: 4,
        height: 4,
        seed: 501,
        winTile: 2048,
        zeroBehavior: "annihilate" as const,
        spawnOnNoopMove: false,
        spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2] }
      },
      initialGrid: Array.from({ length: 4 }, () => [null, null, null, null]),
      moves: ["L"]
    };
    await getRunStore().upsertRun({
      id: "run_501",
      playerId: "u1",
      userTier: "authed",
      gameId: "g_1",
      score: 10,
      maxTile: 2,
      moves: 1,
      seed: 501,
      engineVersion: "test",
      rulesetId: "binary2048-v1",
      integrity: { sessionClass: "ranked", source: "created" },
      createdAtISO: new Date().toISOString(),
      replay
    });
    const res = await GET(new Request("http://localhost/api/runs/run_501/replay"), {
      params: Promise.resolve({ id: "run_501" })
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.header.seed).toBe(501);
  });

  it("returns 404 when replay missing", async () => {
    const res = await GET(new Request("http://localhost/api/runs/run_missing/replay"), {
      params: Promise.resolve({ id: "run_missing" })
    });
    expect(res.status).toBe(404);
  });
});
