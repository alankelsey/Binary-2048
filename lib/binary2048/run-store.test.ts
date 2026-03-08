import { getRunStore, resetRunStoreForTests } from "@/lib/binary2048/run-store";

describe("run-store", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetRunStoreForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses memory store by default", async () => {
    const store = getRunStore();
    await store.upsertRun({
      id: "run_mem_1",
      playerId: "u1",
      userTier: "authed",
      gameId: "g1",
      score: 10,
      maxTile: 2,
      moves: 1,
      seed: 1,
      engineVersion: "dev",
      rulesetId: "binary2048-v1",
      integrity: { sessionClass: "unranked", source: "created" },
      createdAtISO: new Date().toISOString(),
      replay: {
        header: {
          replayVersion: 1,
          rulesetId: "binary2048-v1",
          engineVersion: "dev",
          size: 4,
          seed: 1,
          createdAt: new Date().toISOString()
        },
        config: {
          width: 4,
          height: 4,
          seed: 1,
          winTile: 2048,
          zeroBehavior: "annihilate",
          spawnOnNoopMove: false,
          spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2] }
        },
        initialGrid: Array.from({ length: 4 }, () => [null, null, null, null]),
        moves: ["L"]
      }
    });
    const stored = await store.getRun("run_mem_1");
    expect(stored?.gameId).toBe("g1");
  });

  it("throws when mongo mode is selected without mongo uri", () => {
    process.env.BINARY2048_RUN_STORE = "mongo";
    delete process.env.BINARY2048_MONGO_URI;
    expect(() => getRunStore()).toThrow("BINARY2048_MONGO_URI is required");
  });
});
