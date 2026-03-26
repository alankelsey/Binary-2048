import { getNewGameGuardState } from "@/lib/binary2048/new-game-guard";

describe("getNewGameGuardState", () => {
  it("starts a new game immediately when no active run exists", () => {
    expect(
      getNewGameGuardState({
        replay: false,
        gameId: "g_test",
        turn: 0,
        over: false,
        confirmArmed: false
      })
    ).toEqual({
      requiresConfirm: false,
      nextConfirmArmed: false,
      shouldStartNewGame: true,
      label: "New Game"
    });
  });

  it("arms confirmation on the first tap during an active run", () => {
    expect(
      getNewGameGuardState({
        replay: false,
        gameId: "g_test",
        turn: 4,
        over: false,
        confirmArmed: false
      })
    ).toEqual({
      requiresConfirm: true,
      nextConfirmArmed: true,
      shouldStartNewGame: false,
      label: "New Game"
    });
  });

  it("allows the second tap to start a new game during an active run", () => {
    expect(
      getNewGameGuardState({
        replay: false,
        gameId: "g_test",
        turn: 4,
        over: false,
        confirmArmed: true
      })
    ).toEqual({
      requiresConfirm: true,
      nextConfirmArmed: false,
      shouldStartNewGame: true,
      label: "Confirm New Game"
    });
  });
});
