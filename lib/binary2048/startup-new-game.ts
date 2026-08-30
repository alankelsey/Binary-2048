export type NewGameStartAction = "start" | "queue" | "ignore";

export function getNewGameStartAction(input: {
  busy: boolean;
  initializing: boolean;
  gameId: string;
}): NewGameStartAction {
  if (!input.busy) return "start";
  if (input.initializing && !input.gameId) return "queue";
  return "ignore";
}

