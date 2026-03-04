export function clampReplayStep(step: number, total: number): number {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeStep = Math.floor(Number.isFinite(step) ? step : 0);
  if (safeStep < 0) return 0;
  if (safeStep > safeTotal) return safeTotal;
  return safeStep;
}

export function parseReplayStepInput(value: string, total: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return clampReplayStep(parsed, total);
}
