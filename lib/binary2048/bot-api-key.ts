import { createHash, timingSafeEqual } from "crypto";

export type BotApiKeyIdentity = {
  id: string;
};

const KEY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const SHA256_HEX_PATTERN = /^[a-fA-F0-9]{64}$/;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
function configuredKeyHashes(raw: string | undefined): Array<{ id: string; hash: Buffer }> {
  if (!raw) return [];

  const entries: Array<{ id: string; hash: Buffer }> = [];
  for (const item of raw.split(",")) {
    const separator = item.indexOf("=");
    if (separator <= 0) continue;

    const id = item.slice(0, separator).trim();
    const hashHex = item.slice(separator + 1).trim();
    if (!KEY_ID_PATTERN.test(id) || !SHA256_HEX_PATTERN.test(hashHex)) continue;
    entries.push({ id, hash: Buffer.from(hashHex, "hex") });
  }
  return entries;
}

export function resolveBotApiKey(
  presentedKey: string | null,
  configuredHashes = process.env.BINARY2048_BOT_API_KEY_HASHES
): BotApiKeyIdentity | null {
  const key = presentedKey?.trim();
  if (!key || key.length > 512) return null;

  const presentedHash = sha256(key);
  for (const entry of configuredKeyHashes(configuredHashes)) {
    if (entry.hash.length === presentedHash.length && timingSafeEqual(entry.hash, presentedHash)) {
      return { id: entry.id };
    }
  }
  return null;
}
