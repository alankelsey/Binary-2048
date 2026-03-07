import { buildGhostRaceChallenge, resetGhostRaceStore, submitGhostRaceReplay } from "@/lib/binary2048/ghost-race";
import { runScenario } from "@/lib/binary2048/engine";

describe("ghost-race", () => {
  beforeEach(() => resetGhostRaceStore());

  it("builds deterministic challenge for same seed", () => {
    const a = buildGhostRaceChallenge(4444, 120);
    const b = buildGhostRaceChallenge(4444, 120);
    expect(a.ghost.score).toBe(b.ghost.score);
    expect(a.ghost.moves).toEqual(b.ghost.moves);
    expect(a.initialGrid).toEqual(b.initialGrid);
  });

  it("submits replay and compares against ghost", () => {
    const challenge = buildGhostRaceChallenge(9999, 80);
    const exported = runScenario(challenge.config, challenge.initialGrid, ["left", "up", "right", "down"]);
    const submitted = submitGhostRaceReplay("player_1", exported);
    expect(submitted.challengeId).toBe("ghost_9999");
    expect(typeof submitted.beatGhost).toBe("boolean");
    expect(submitted.playerId).toBe("player_1");
  });
});
