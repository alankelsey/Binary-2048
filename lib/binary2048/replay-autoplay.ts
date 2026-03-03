export function replaySpeedToDelayMs(speed: number): number {
  const s = Math.min(10, Math.max(1, Math.floor(speed)));
  return 1100 - s * 100;
}
