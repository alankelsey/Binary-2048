import { toCompactReplayPayload, type CompactReplayPayload } from "@/lib/binary2048/replay-format";
import { deflateRawSync, inflateRawSync } from "zlib";

export const REPLAY_CODE_MAX_LEN = 3500;
const PREFIX_PLAIN = "r1.";
const PREFIX_COMPRESSED = "r1z.";

function toBase64Url(input: Buffer | string): string {
  const base64 = (typeof input === "string" ? Buffer.from(input, "utf8") : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return base64;
}

function fromBase64UrlToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function createReplayCode(payload: unknown) {
  const compact = toCompactReplayPayload(payload);
  const json = JSON.stringify(compact);
  const plainCode = `${PREFIX_PLAIN}${toBase64Url(json)}`;
  const compressedCode = `${PREFIX_COMPRESSED}${toBase64Url(deflateRawSync(Buffer.from(json, "utf8")))}`;
  const useCompressed = plainCode.length > REPLAY_CODE_MAX_LEN && compressedCode.length < plainCode.length;
  const code = useCompressed ? compressedCode : plainCode;
  return {
    payload: compact,
    code,
    length: code.length,
    overLimit: code.length > REPLAY_CODE_MAX_LEN,
    compressed: useCompressed
  };
}

export function parseReplayCode(code: string): CompactReplayPayload {
  if (!code || typeof code !== "string") throw new Error("code is required");
  let json = "";
  if (code.startsWith(PREFIX_COMPRESSED)) {
    const raw = fromBase64UrlToBuffer(code.slice(PREFIX_COMPRESSED.length));
    json = inflateRawSync(raw).toString("utf8");
  } else if (code.startsWith(PREFIX_PLAIN)) {
    json = fromBase64UrlToBuffer(code.slice(PREFIX_PLAIN.length)).toString("utf8");
  } else {
    // Backward compatibility with legacy base64url-json replay codes.
    json = fromBase64UrlToBuffer(code).toString("utf8");
  }
  const parsed = JSON.parse(json);
  return toCompactReplayPayload(parsed);
}
