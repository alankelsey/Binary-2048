type NewGameGuardInput = {
  replay: boolean;
  gameId: string;
  turn: number;
  over: boolean;
  confirmArmed: boolean;
};

export type NewGameGuardState = {
  requiresConfirm: boolean;
  nextConfirmArmed: boolean;
  shouldStartNewGame: boolean;
  label: string;
};

export function getNewGameGuardState(input: NewGameGuardInput): NewGameGuardState {
  const isActiveRun = Boolean(!input.replay && input.gameId && input.turn > 0 && !input.over);
  const requiresConfirm = isActiveRun;

  if (!requiresConfirm) {
    return {
      requiresConfirm: false,
      nextConfirmArmed: false,
      shouldStartNewGame: true,
      label: "New Game"
    };
  }

  if (input.confirmArmed) {
    return {
      requiresConfirm: true,
      nextConfirmArmed: false,
      shouldStartNewGame: true,
      label: "Confirm New Game"
    };
  }

  return {
    requiresConfirm: true,
    nextConfirmArmed: true,
    shouldStartNewGame: false,
    label: "New Game"
  };
}
