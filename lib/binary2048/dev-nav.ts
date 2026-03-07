export function isDevNavEnabled(options?: { nodeEnv?: string; forceFlag?: string }) {
  const forced = options?.forceFlag?.trim() ?? process.env.BINARY2048_DEV_NAV?.trim();
  if (forced === "1" || forced?.toLowerCase() === "true") return true;
  if (forced === "0" || forced?.toLowerCase() === "false") return false;
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  return nodeEnv !== "production";
}
