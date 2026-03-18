export function buildReplayUrl(origin: string, code: string): string {
  const safeOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${safeOrigin}/replay?code=${encodeURIComponent(code)}`;
}

export function getReplayShareErrorMessage(status: number): string {
  if (status === 404) {
    return "Current run is no longer available to export. Start a new run to create a replay link.";
  }
  return "Failed to create replay link";
}
