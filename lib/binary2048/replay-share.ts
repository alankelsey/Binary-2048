export function buildReplayUrl(origin: string, code: string): string {
  const safeOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${safeOrigin}/replay?code=${encodeURIComponent(code)}`;
}
