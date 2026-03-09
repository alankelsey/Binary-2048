import { POST } from "@/app/api/replay/ingest/route";
import { getRunStore, resetRunStoreForTests } from "@/lib/binary2048/run-store";

const baseRecord = {
  id: "run_ingest_1",
  playerId: "u_ingest",
  userTier: "authed" as const,
  gameId: "g_ingest_1",
  score: 123,
  maxTile: 16,
  moves: 20,
  seed: 42,
  engineVersion: "0.1.0",
  rulesetId: "binary2048-v1",
  integrity: { sessionClass: "ranked" as const, source: "created" as const },
  createdAtISO: new Date().toISOString(),
  replay: {
    header: {
      replayVersion: 1 as const,
      rulesetId: "binary2048-v1",
      engineVersion: "0.1.0",
      size: 4,
      seed: 42,
      createdAt: new Date().toISOString()
    },
    config: {
      width: 4,
      height: 4,
      seed: 42,
      winTile: 2048,
      zeroBehavior: "annihilate" as const,
      spawnOnNoopMove: false,
      spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2] }
    },
    initialGrid: Array.from({ length: 4 }, () => [null, null, null, null]),
    moves: ["left" as const]
  }
};

describe("POST /api/replay/ingest", () => {
  afterEach(() => {
    resetRunStoreForTests();
  });

  it("rejects missing records", async () => {
    const req = new Request("http://localhost/api/replay/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("upserts deduped records and reports duplicate ids", async () => {
    const req = new Request("http://localhost/api/replay/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        records: [baseRecord, { ...baseRecord, score: 999 }, { ...baseRecord, id: "run_ingest_2", gameId: "g_ingest_2" }]
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ingested).toBe(2);
    expect(json.duplicateIds).toContain("run_ingest_1");

    const store = getRunStore();
    const updated = await store.getRun("run_ingest_1");
    const second = await store.getRun("run_ingest_2");
    expect(updated?.score).toBe(999);
    expect(second?.gameId).toBe("g_ingest_2");
  });
});

