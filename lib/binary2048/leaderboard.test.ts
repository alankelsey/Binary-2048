import { createSession, moveSession } from "@/lib/binary2048/sessions";
import {
  LEADERBOARD_INDEX_SPECS,
  listLeaderboardEntries,
  listLeaderboardEntriesByPlayer,
  removeLeaderboardEntriesByPlayer,
  resetLeaderboard,
  submitLeaderboardEntry
} from "@/lib/binary2048/leaderboard";
import type { Cell } from "@/lib/binary2048/types";
import { MongoClient } from "mongodb";

jest.mock("mongodb", () => ({ MongoClient: jest.fn() }));

const MockMongoClient = MongoClient as unknown as jest.Mock;

describe("leaderboard", () => {
  afterEach(async () => {
    await resetLeaderboard();
    delete process.env.BINARY2048_LEADERBOARD_STORE;
    delete process.env.BINARY2048_MONGO_URI;
    jest.useRealTimers();
    jest.restoreAllMocks();
    MockMongoClient.mockReset();
  });

  it("submits server-derived ranked run snapshots and sorts by score", async () => {
    const initialA: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "n", v: 2 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const sessionA = createSession({ seed: 401, winTile: 8, spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } }, initialA, { sessionClass: "ranked" });
    moveSession(sessionA.current.id, "left");

    const initialB: Cell[][] = [
      [{ t: "n", v: 4 }, { t: "n", v: 4 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const sessionB = createSession({ seed: 402, winTile: 16, spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } }, initialB, { sessionClass: "ranked" });
    moveSession(sessionB.current.id, "left");

    const low = await submitLeaderboardEntry({
      playerId: "u_low",
      userTier: "authed",
      gameId: sessionA.current.id,
      session: sessionA
    });
    const high = await submitLeaderboardEntry({
      playerId: "u_high",
      userTier: "paid",
      gameId: sessionB.current.id,
      session: sessionB
    });

    expect(low.entry.score).toBeLessThan(high.entry.score);
    expect(high.rank).toBe(1);
    expect(low.rank).toBe(1);
    expect(await listLeaderboardEntries()).toHaveLength(2);
    expect((await listLeaderboardEntries())[0]?.playerId).toBe("u_high");
  });

  it("tracks only moved steps for move count", async () => {
    const initial: Cell[][] = [
      [{ t: "n", v: 1 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const session = createSession({ seed: 403 }, initial, { sessionClass: "ranked" });
    moveSession(session.current.id, "left");
    moveSession(session.current.id, "right");
    const submitted = await submitLeaderboardEntry({
      playerId: "u_moves",
      userTier: "authed",
      gameId: session.current.id,
      session
    });
    expect(submitted.entry.moves).toBe(1);
  });

  it("isolates sandbox namespace from production listings by default", async () => {
    const initial: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "n", v: 2 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const prod = createSession({ seed: 404, spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } }, initial, { sessionClass: "ranked" });
    moveSession(prod.current.id, "left");
    await submitLeaderboardEntry({
      playerId: "u_prod",
      userTier: "authed",
      gameId: prod.current.id,
      session: prod
    });

    const sandbox = createSession({ seed: 405, spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } }, initial, { sessionClass: "ranked" });
    moveSession(sandbox.current.id, "left");
    await submitLeaderboardEntry({
      namespace: "sandbox",
      isSandbox: true,
      seasonMode: "preview",
      playerId: "u_sandbox",
      userTier: "authed",
      gameId: sandbox.current.id,
      session: sandbox
    });

    expect(await listLeaderboardEntries()).toHaveLength(1);
    expect((await listLeaderboardEntries())[0]?.playerId).toBe("u_prod");
    expect(await listLeaderboardEntries(20, { namespace: "sandbox", includeSandbox: true, includePractice: true })).toHaveLength(1);
  });

  it("preserves the original submission time on an idempotent upsert", async () => {
    const session = createSession({ seed: 406 });
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const first = await submitLeaderboardEntry({ playerId: "u_same", userTier: "authed", gameId: "same", session });
    jest.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    session.current.score = 99;
    const second = await submitLeaderboardEntry({ playerId: "u_same", userTier: "authed", gameId: "same", session });
    expect(second.entry.submittedAtISO).toBe(first.entry.submittedAtISO);
    expect(second.entry.score).toBe(99);
    expect(second.total).toBe(1);
  });

  it("reports rank and total beyond the default top-20 window with deterministic id ties", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    let last: Awaited<ReturnType<typeof submitLeaderboardEntry>> | undefined;
    const tiedGrid: Cell[][] = [
      [{ t: "n", v: 1 }, { t: "n", v: 1 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    for (let index = 0; index < 25; index += 1) {
      const session = createSession({ seed: 500 + index }, tiedGrid);
      session.current.score = 100;
      last = await submitLeaderboardEntry({ playerId: `u_${index}`, userTier: "authed", gameId: `game_${String(index).padStart(2, "0")}`, session });
    }
    expect(last).toMatchObject({ rank: 25, total: 25 });
    expect(await listLeaderboardEntries()).toHaveLength(20);
  });

  it("filters practice and season entries and supports player deletion", async () => {
    const live = createSession({ seed: 601 });
    const practice = createSession({ seed: 602 });
    await submitLeaderboardEntry({ playerId: "u_filter", userTier: "authed", gameId: "live", session: live });
    await submitLeaderboardEntry({ playerId: "u_filter", userTier: "authed", gameId: "practice", session: practice, isPractice: true, seasonMode: "preview" });
    expect(await listLeaderboardEntries()).toHaveLength(1);
    expect(await listLeaderboardEntries(20, { includePractice: true, seasonMode: "preview" })).toHaveLength(1);
    expect(await listLeaderboardEntriesByPlayer("u_filter")).toHaveLength(2);
    expect(await removeLeaderboardEntriesByPlayer("u_filter")).toBe(2);
    expect(await listLeaderboardEntriesByPlayer("u_filter")).toHaveLength(0);
  });

  it("fails closed for an invalid store mode or missing Mongo URI", async () => {
    process.env.BINARY2048_LEADERBOARD_STORE = "redis";
    await expect(listLeaderboardEntries()).rejects.toThrow("Unsupported BINARY2048_LEADERBOARD_STORE: redis");
    await resetLeaderboard();
    process.env.BINARY2048_LEADERBOARD_STORE = "mongo";
    await expect(listLeaderboardEntries()).rejects.toThrow("BINARY2048_MONGO_URI is required");
  });

  it("declares unique, filtered-sort, and player indexes", () => {
    expect(LEADERBOARD_INDEX_SPECS.map((index) => index.name)).toEqual([
      "uniq_leaderboard_id",
      "leaderboard_filter_sort",
      "leaderboard_player"
    ]);
    expect(LEADERBOARD_INDEX_SPECS[0]?.unique).toBe(true);
  });

  it("logs only safe metadata and retries after transient Mongo initialization failure", async () => {
    process.env.BINARY2048_LEADERBOARD_STORE = "mongo";
    process.env.BINARY2048_MONGO_URI = "mongodb+srv://user:secret@example.invalid/db";
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const toArray = jest.fn().mockResolvedValue([]);
    const collection = {
      createIndexes: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ toArray }), toArray }) }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 })
    };
    const connect = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error("secret@example.invalid refused"), { name: "MongoServerSelectionError", code: "ETIMEDOUT" }))
      .mockResolvedValueOnce(undefined);
    MockMongoClient.mockImplementation(() => ({
      connect,
      db: jest.fn().mockReturnValue({ collection: jest.fn().mockReturnValue(collection) })
    }));

    await expect(listLeaderboardEntries()).rejects.toThrow("secret@example.invalid refused");
    await expect(listLeaderboardEntries()).resolves.toEqual([]);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith("Mongo leaderboard store initialization failed", {
      event: "leaderboard_mongo_initialization_failed",
      errorName: "MongoServerSelectionError",
      errorCode: "ETIMEDOUT"
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret@example.invalid");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("mongodb+srv");
  });
});
