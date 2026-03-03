export function getReplayCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get("code") ?? params.get("replayCode");
  if (!code) return null;
  const trimmed = code.trim();
  return trimmed.length > 0 ? trimmed : null;
}
