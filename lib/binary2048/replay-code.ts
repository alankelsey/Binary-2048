import { toCompactReplayPayload, type CompactReplayPayload } from "@/lib/binary2048/replay-format";

export const REPLAY_CODE_MAX_LEN = 3500;

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export function createReplayCode(payload: unknown) {
  const compact = toCompactReplayPayload(payload);
  const json = JSON.stringify(compact);
  const code = toBase64Url(json);
  return {
    payload: compact,
    code,
    length: code.length,
    overLimit: code.length > REPLAY_CODE_MAX_LEN
  };
}

export function parseReplayCode(code: string): CompactReplayPayload {
  if (!code || typeof code !== "string") throw new Error("code is required");
  const json = fromBase64Url(code);
  const parsed = JSON.parse(json);
  return toCompactReplayPayload(parsed);
}
