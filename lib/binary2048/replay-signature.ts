import { createHmac, timingSafeEqual } from "crypto";
import { toCompactReplayPayload, type CompactReplayPayload, validateReplayHeader } from "@/lib/binary2048/replay-format";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

function toBase64Url(input: Buffer | string): string {
  const base64 = (typeof input === "string" ? Buffer.from(input, "utf8") : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return base64;
}

function serializeReplayPayload(compact: CompactReplayPayload): string {
  return JSON.stringify({
    header: compact.header,
    config: compact.config,
    initialGrid: compact.initialGrid,
    moves: compact.moves
  });
}

function isCompactReplayLike(value: unknown): value is {
  header: CompactReplayPayload["header"];
  config: GameConfig;
  initialGrid: Cell[][];
  moves: unknown[];
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Boolean(v.header && v.config && Array.isArray(v.initialGrid) && Array.isArray(v.moves));
}

export function createReplaySignature(payload: unknown, signingSecret: string): string {
  if (!signingSecret) throw new Error("Replay signing secret is not configured");
  const compact = (() => {
    if (isCompactReplayLike(payload)) {
      const normalized: CompactReplayPayload = {
        header: payload.header,
        config: payload.config,
        initialGrid: payload.initialGrid,
        moves: payload.moves as CompactReplayPayload["moves"]
      };
      validateReplayHeader(normalized.header, normalized.config, normalized.initialGrid);
      return normalized;
    }
    return toCompactReplayPayload(payload);
  })();
  const serialized = serializeReplayPayload(compact);
  return toBase64Url(createHmac("sha256", signingSecret).update(serialized).digest());
}

export function verifyReplaySignature(payload: unknown, signature: string, signingSecret: string): boolean {
  if (!signature || !signingSecret) return false;
  const expected = createReplaySignature(payload, signingSecret);
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
