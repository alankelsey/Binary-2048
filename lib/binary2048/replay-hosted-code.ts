import type { CompactReplayPayload } from "@/lib/binary2048/replay-format";
import { toCompactReplayPayload } from "@/lib/binary2048/replay-format";
import { getRunStore, type CanonicalRunRecord } from "@/lib/binary2048/run-store";
import { createHash, createHmac, timingSafeEqual } from "crypto";

const HOSTED_PREFIX = "rs1";
const DEFAULT_TTL_MS = 15 * 60 * 1000;

type HostedReplayRecord = {
  payload: CompactReplayPayload;
  expiresAt: number;
};

const hostedReplayStore = new Map<string, HostedReplayRecord>();

function toBase64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signHostedToken(id: string, expiresAt: number, secret: string): string {
  const message = `${id}.${expiresAt}`;
  return toBase64Url(createHmac("sha256", secret).update(message).digest());
}

function cleanupExpired(now = Date.now()) {
  for (const [id, record] of hostedReplayStore.entries()) {
    if (record.expiresAt <= now) hostedReplayStore.delete(id);
  }
}

function hostedReplayId(payload: CompactReplayPayload): string {
  const json = JSON.stringify(payload);
  return `share_${createHash("sha256").update(json).digest("hex").slice(0, 24)}`;
}

function toHostedRunRecord(id: string, payload: CompactReplayPayload): CanonicalRunRecord {
  return {
    id,
    playerId: "share",
    userTier: "guest",
    gameId: id,
    score: 0,
    maxTile: 0,
    moves: payload.moves.length,
    seed: payload.header.seed,
    engineVersion: payload.header.engineVersion,
    rulesetId: payload.header.rulesetId,
    integrity: {
      sessionClass: "unranked",
      source: "imported"
    },
    createdAtISO: payload.header.createdAt,
    replay: payload
  };
}

export function isHostedReplayCode(code: string): boolean {
  return typeof code === "string" && code.startsWith(`${HOSTED_PREFIX}.`);
}

export async function createHostedReplayCode(
  payload: CompactReplayPayload,
  secret: string,
  ttlMs = DEFAULT_TTL_MS
) {
  if (!secret || secret.trim().length === 0) {
    throw new Error("hosted replay secret is required");
  }
  const normalized = toCompactReplayPayload(payload);
  const now = Date.now();
  cleanupExpired(now);
  const id = hostedReplayId(normalized);
  const expiresAt = now + Math.max(1, Math.floor(ttlMs));
  hostedReplayStore.set(id, { payload: normalized, expiresAt });
  await getRunStore().upsertRun(toHostedRunRecord(id, normalized));
  const signature = signHostedToken(id, expiresAt, secret);
  return {
    code: `${HOSTED_PREFIX}.${id}.${expiresAt}.${signature}`,
    expiresAt
  };
}

export async function parseHostedReplayCode(code: string, secret: string): Promise<CompactReplayPayload> {
  if (!secret || secret.trim().length === 0) {
    throw new Error("hosted replay secret is required");
  }
  if (!isHostedReplayCode(code)) {
    throw new Error("invalid hosted replay code");
  }
  const [, id, rawExpiry, signature] = code.split(".");
  if (!id || !rawExpiry || !signature) throw new Error("invalid hosted replay code");

  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error("invalid hosted replay expiry");
  }

  const expectedSignature = signHostedToken(id, expiresAt, secret);
  const actual = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("invalid hosted replay signature");
  }

  const now = Date.now();
  cleanupExpired(now);
  if (expiresAt <= now) throw new Error("hosted replay expired");

  const record = hostedReplayStore.get(id);
  if (record) {
    if (record.expiresAt <= now) {
      hostedReplayStore.delete(id);
      throw new Error("hosted replay expired");
    }
    return record.payload;
  }

  const persisted = await getRunStore().getRunReplay(id);
  if (!persisted) throw new Error("hosted replay not found");
  hostedReplayStore.set(id, { payload: persisted, expiresAt });
  return persisted;
}
