import { toCompactReplayPayload, type CompactReplayPayload } from "@/lib/binary2048/replay-format";
import { createHmac, timingSafeEqual } from "crypto";
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

function sign(value: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(value).digest());
}

function splitOptionalSignature(code: string) {
  const firstDot = code.indexOf(".");
  if (firstDot < 0) return { unsigned: code, sig: "" };
  const lastDot = code.lastIndexOf(".");
  if (lastDot <= firstDot) return { unsigned: code, sig: "" };
  return {
    unsigned: code.slice(0, lastDot),
    sig: code.slice(lastDot + 1)
  };
}

export function createReplayCode(payload: unknown, signingSecret?: string) {
  const compact = toCompactReplayPayload(payload);
  const json = JSON.stringify(compact);
  const plainCode = `${PREFIX_PLAIN}${toBase64Url(json)}`;
  const compressedCode = `${PREFIX_COMPRESSED}${toBase64Url(deflateRawSync(Buffer.from(json, "utf8")))}`;
  const useCompressed = plainCode.length > REPLAY_CODE_MAX_LEN && compressedCode.length < plainCode.length;
  const unsignedCode = useCompressed ? compressedCode : plainCode;
  const hasSigningSecret = typeof signingSecret === "string" && signingSecret.length > 0;
  const sig = hasSigningSecret ? sign(unsignedCode, signingSecret) : "";
  const code = sig ? `${unsignedCode}.${sig}` : unsignedCode;
  return {
    payload: compact,
    code,
    length: code.length,
    overLimit: code.length > REPLAY_CODE_MAX_LEN,
    compressed: useCompressed,
    signed: Boolean(sig)
  };
}

export function parseReplayCode(code: string, signingSecret?: string): CompactReplayPayload {
  if (!code || typeof code !== "string") throw new Error("code is required");
  const { unsigned, sig } = splitOptionalSignature(code);
  if (sig) {
    if (!signingSecret) throw new Error("replay code signature cannot be verified");
    const expected = sign(unsigned, signingSecret);
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("invalid replay code signature");
  }

  let json = "";
  if (unsigned.startsWith(PREFIX_COMPRESSED)) {
    const raw = fromBase64UrlToBuffer(unsigned.slice(PREFIX_COMPRESSED.length));
    json = inflateRawSync(raw).toString("utf8");
  } else if (unsigned.startsWith(PREFIX_PLAIN)) {
    json = fromBase64UrlToBuffer(unsigned.slice(PREFIX_PLAIN.length)).toString("utf8");
  } else {
    // Backward compatibility with legacy base64url-json replay codes.
    json = fromBase64UrlToBuffer(unsigned).toString("utf8");
  }
  const parsed = JSON.parse(json);
  return toCompactReplayPayload(parsed);
}
