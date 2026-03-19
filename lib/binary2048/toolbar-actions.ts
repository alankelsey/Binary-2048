type ToolbarActionStateInput = {
  replay: boolean;
  gameId: string;
  turn: number;
  over: boolean;
  undoRemaining: number;
};

export type ToolbarActionState = {
  disableNewGame: boolean;
  disableReplayImport: boolean;
  disableUndo: boolean;
};

export function getToolbarActionState(input: ToolbarActionStateInput): ToolbarActionState {
  const { replay, gameId, turn, over, undoRemaining } = input;

  return {
    disableNewGame: false,
    disableReplayImport: false,
    disableUndo: !Boolean(!replay && gameId && turn > 0 && !over && undoRemaining > 0)
  };
}
