export function isFullscreenToggleEnabled(options?: { nodeEnv?: string }) {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  return nodeEnv !== "production";
}
