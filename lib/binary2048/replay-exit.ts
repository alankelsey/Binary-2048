export function shouldStartNewGameOnReplayExit(hasLiveState: boolean): boolean {
  return !hasLiveState;
}
