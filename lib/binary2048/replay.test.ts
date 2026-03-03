import { parseReplayExport, replayStateAtStep } from "@/lib/binary2048/replay";
import type { GameExport, GameState } from "@/lib/binary2048/types";

function makeState(turn: number, score: number): GameState {
  return {
    id: "g_test",
    config: {
      width: 4,
      height: 4,
      seed: 1,
      winTile: 2048,
      zeroBehavior: "annihilate",
      spawnOnNoopMove: false,
      spawn: { pZero: 0.1, pOne: 0.8, pWildcard: 0.1, wildcardMultipliers: [2] }
    },
    width: 4,
    height: 4,
    seed: 1,
    rngStep: 0,
    score,
    turn,
    won: false,
    over: false,
    grid: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => null))
  };
}

describe("replay helpers", () => {
  const initial = makeState(0, 0);
  const after1 = makeState(1, 1);
  const after2 = makeState(2, 3);

  const exported: GameExport = {
    version: 1,
    meta: {
      createdAtISO: "2026-01-01T00:00:00.000Z",
      engine: "binary2048",
      rulesetId: "binary2048-v1",
      engineVersion: "test",
      replay: { seed: 1, moves: ["right", "down"], movesApplied: 2 },
      integrity: { sessionClass: "unranked", source: "created" }
    },
    config: initial.config,
    initial,
    steps: [
      { turn: 1, dir: "right", moved: true, before: initial, after: after1, events: [] },
      { turn: 2, dir: "down", moved: true, before: after1, after: after2, events: [] }
    ],
    final: after2
  };

  it("parses valid export payload", () => {
    const replay = parseReplayExport(exported);
    expect(replay).not.toBeNull();
    expect(replay?.steps.length).toBe(2);
  });

  it("returns null for invalid replay payload", () => {
    expect(parseReplayExport({})).toBeNull();
    expect(parseReplayExport({ steps: [] })).toBeNull();
  });

  it("returns initial/final and step after states correctly", () => {
    const replay = parseReplayExport(exported);
    if (!replay) throw new Error("expected replay payload");

    expect(replayStateAtStep(replay, 0).turn).toBe(0);
    expect(replayStateAtStep(replay, 1).turn).toBe(1);
    expect(replayStateAtStep(replay, 2).turn).toBe(2);
    expect(replayStateAtStep(replay, 999).turn).toBe(2);
  });
});
