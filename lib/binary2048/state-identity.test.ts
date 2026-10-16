import { createGame } from "@/lib/binary2048/engine";
import {
  canonicalGameState,
  gameStateHash,
  legacyGameStateHashV1,
  STATE_HASH_VERSION
} from "@/lib/binary2048/state-identity";

describe("versioned game-state identity", () => {
  it("uses a stable named version and canonical field order", () => {
    const state = createGame({ seed: 2048 }).state;
    expect(STATE_HASH_VERSION).toBe("fnv1a32-game-state-v2");
    expect(canonicalGameState(state)).toBe(canonicalGameState(structuredClone(state)));
    expect(gameStateHash(state)).toMatch(/^[0-9a-f]{8}$/);
  });

  it.each([
    ["turn", (state: ReturnType<typeof createGame>["state"]) => ({ ...state, turn: state.turn + 1 })],
    ["score", (state: ReturnType<typeof createGame>["state"]) => ({ ...state, score: state.score + 1 })],
    ["rng", (state: ReturnType<typeof createGame>["state"]) => ({ ...state, rngStep: state.rngStep + 1 })],
    ["terminal", (state: ReturnType<typeof createGame>["state"]) => ({ ...state, over: !state.over })],
    ["config", (state: ReturnType<typeof createGame>["state"]) => ({
      ...state,
      config: { ...state.config, winTile: state.config.winTile * 2 }
    })]
  ])("changes when deterministic %s state changes", (_name, mutate) => {
    const state = createGame({ seed: 4096 }).state;
    expect(gameStateHash(mutate(state))).not.toBe(gameStateHash(state));
  });

  it("retains the legacy hash for unversioned request compatibility", () => {
    const state = createGame({ seed: 8192 }).state;
    expect(legacyGameStateHashV1(state)).toMatch(/^[0-9a-f]{8}$/);
    expect(legacyGameStateHashV1({
      grid: state.grid,
      turn: state.turn,
      score: state.score,
      rngStep: state.rngStep
    })).toBe(legacyGameStateHashV1(state));
  });
});
