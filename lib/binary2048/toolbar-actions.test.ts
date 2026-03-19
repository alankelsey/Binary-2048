import { getToolbarActionState } from "@/lib/binary2048/toolbar-actions";

describe("getToolbarActionState", () => {
  it("keeps new game and replay import visually enabled during active turns", () => {
    const state = getToolbarActionState({
      replay: false,
      gameId: "g_test",
      turn: 3,
      over: false,
      undoRemaining: 1
    });

    expect(state.disableNewGame).toBe(false);
    expect(state.disableReplayImport).toBe(false);
  });

  it("disables undo only when there is no playable turn or no undo charge left", () => {
    const enabled = getToolbarActionState({
      replay: false,
      gameId: "g_test",
      turn: 2,
      over: false,
      undoRemaining: 1
    });
    const disabledNoTurn = getToolbarActionState({
      replay: false,
      gameId: "g_test",
      turn: 0,
      over: false,
      undoRemaining: 1
    });
    const disabledNoCharge = getToolbarActionState({
      replay: false,
      gameId: "g_test",
      turn: 2,
      over: false,
      undoRemaining: 0
    });

    expect(enabled.disableUndo).toBe(false);
    expect(disabledNoTurn.disableUndo).toBe(true);
    expect(disabledNoCharge.disableUndo).toBe(true);
  });
});
