import { createSession, moveSession } from "@/lib/binary2048/sessions";
import { listLeaderboardEntries, resetLeaderboard, submitLeaderboardEntry } from "@/lib/binary2048/leaderboard";
import type { Cell } from "@/lib/binary2048/types";

describe("leaderboard", () => {
  afterEach(() => {
    resetLeaderboard();
  });

  it("submits server-derived ranked run snapshots and sorts by score", () => {
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

    const low = submitLeaderboardEntry({
      playerId: "u_low",
      userTier: "authed",
      gameId: sessionA.current.id,
      session: sessionA
    });
    const high = submitLeaderboardEntry({
      playerId: "u_high",
      userTier: "paid",
      gameId: sessionB.current.id,
      session: sessionB
    });

    expect(low.entry.score).toBeLessThan(high.entry.score);
    expect(high.rank).toBe(1);
    expect(low.rank).toBe(1);
    expect(listLeaderboardEntries()).toHaveLength(2);
    expect(listLeaderboardEntries()[0]?.playerId).toBe("u_high");
  });

  it("tracks only moved steps for move count", () => {
    const initial: Cell[][] = [
      [{ t: "n", v: 1 }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const session = createSession({ seed: 403 }, initial, { sessionClass: "ranked" });
    moveSession(session.current.id, "left");
    moveSession(session.current.id, "right");
    const submitted = submitLeaderboardEntry({
      playerId: "u_moves",
      userTier: "authed",
      gameId: session.current.id,
      session
    });
    expect(submitted.entry.moves).toBe(1);
  });

  it("isolates sandbox namespace from production listings by default", () => {
    const initial: Cell[][] = [
      [{ t: "n", v: 2 }, { t: "n", v: 2 }, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null]
    ];
    const prod = createSession({ seed: 404, spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } }, initial, { sessionClass: "ranked" });
    moveSession(prod.current.id, "left");
    submitLeaderboardEntry({
      playerId: "u_prod",
      userTier: "authed",
      gameId: prod.current.id,
      session: prod
    });

    const sandbox = createSession({ seed: 405, spawn: { pZero: 0, pOne: 1, pWildcard: 0, pLock: 0, wildcardMultipliers: [2] } }, initial, { sessionClass: "ranked" });
    moveSession(sandbox.current.id, "left");
    submitLeaderboardEntry({
      namespace: "sandbox",
      isSandbox: true,
      seasonMode: "preview",
      playerId: "u_sandbox",
      userTier: "authed",
      gameId: sandbox.current.id,
      session: sandbox
    });

    expect(listLeaderboardEntries()).toHaveLength(1);
    expect(listLeaderboardEntries()[0]?.playerId).toBe("u_prod");
    expect(listLeaderboardEntries(20, { namespace: "sandbox", includeSandbox: true, includePractice: true })).toHaveLength(1);
  });
});
