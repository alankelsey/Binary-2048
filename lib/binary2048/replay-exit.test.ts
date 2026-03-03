import { shouldStartNewGameOnReplayExit } from "@/lib/binary2048/replay-exit";

describe("shouldStartNewGameOnReplayExit", () => {
  it("starts a new game when no live state exists", () => {
    expect(shouldStartNewGameOnReplayExit(false)).toBe(true);
  });

  it("keeps current game when live state exists", () => {
    expect(shouldStartNewGameOnReplayExit(true)).toBe(false);
  });
});
