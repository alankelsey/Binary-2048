import { createHmac, timingSafeEqual } from "crypto";
import { grantInventory, type StoreSku } from "@/lib/binary2048/inventory";
import type { UserTier } from "@/lib/binary2048/security-policy";

type FraudRecord = {
  dayKey: string;
  count: number;
  lastGrantAtMs: number;
  seenNonces: Set<string>;
};

type GrantInput = {
  subscriberId: string;
  tier: UserTier;
  sku: StoreSku;
  quantity: number;
  nonce: string;
  timestampSec: number;
  nowMs?: number;
  env?: Record<string, string | undefined>;
};

export class AdRewardGrantError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AdRewardGrantError";
    this.status = status;
    this.code = code;
  }
}

const globalStore = globalThis as typeof globalThis & {
  __binary2048_ad_reward_records?: Map<string, FraudRecord>;
};

const records = globalStore.__binary2048_ad_reward_records ?? new Map<string, FraudRecord>();
globalStore.__binary2048_ad_reward_records = records;

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function isAdsEnabled(env: Record<string, string | undefined>) {
  const value = (env.BINARY2048_ADS_ENABLED ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function dayKey(nowMs: number) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function getOrCreateRecord(subscriberId: string, nowMs: number): FraudRecord {
  const key = dayKey(nowMs);
  const existing = records.get(subscriberId);
  if (!existing || existing.dayKey !== key) {
    const created: FraudRecord = { dayKey: key, count: 0, lastGrantAtMs: 0, seenNonces: new Set<string>() };
    records.set(subscriberId, created);
    return created;
  }
  return existing;
}

function parseNonce(nonce: string) {
  if (!nonce || nonce.length < 8 || nonce.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(nonce)) {
    throw new AdRewardGrantError("Invalid nonce", 400, "invalid_nonce");
  }
}

export function createAdRewardSignature(rawPayload: string, secret: string) {
  return createHmac("sha256", secret).update(rawPayload).digest("hex");
}

export function verifyAdRewardSignature(rawPayload: string, signature: string, secret: string) {
  if (!secret) return false;
  if (!signature || typeof signature !== "string") return false;
  const expected = createAdRewardSignature(rawPayload, secret);
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function grantVerifiedAdReward(input: GrantInput) {
  const nowMs = input.nowMs ?? Date.now();
  const env = input.env ?? process.env;
  const maxSkewSec = parsePositiveInt(env.BINARY2048_AD_REWARD_MAX_SKEW_SEC, 300);
  const dailyCap = parsePositiveInt(env.BINARY2048_AD_REWARD_DAILY_CAP, 5);
  const cooldownSec = parsePositiveInt(env.BINARY2048_AD_REWARD_COOLDOWN_SEC, 60);

  if (!isAdsEnabled(env)) {
    throw new AdRewardGrantError("Ads rewards are disabled", 403, "ads_disabled");
  }
  if (input.tier === "paid") {
    throw new AdRewardGrantError("Paid tier is ad-free", 403, "paid_tier_ad_free");
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 3) {
    throw new AdRewardGrantError("Invalid reward quantity", 400, "invalid_quantity");
  }
  if (!Number.isFinite(input.timestampSec)) {
    throw new AdRewardGrantError("Invalid timestamp", 400, "invalid_timestamp");
  }
  const skewSec = Math.abs(Math.floor(nowMs / 1000) - Math.floor(input.timestampSec));
  if (skewSec > maxSkewSec) {
    throw new AdRewardGrantError("Stale reward payload", 400, "stale_payload");
  }

  parseNonce(input.nonce);
  const record = getOrCreateRecord(input.subscriberId, nowMs);

  if (record.seenNonces.has(input.nonce)) {
    throw new AdRewardGrantError("Replay nonce detected", 409, "replay_nonce");
  }
  if (record.lastGrantAtMs > 0 && nowMs - record.lastGrantAtMs < cooldownSec * 1000) {
    throw new AdRewardGrantError("Reward cooldown active", 429, "cooldown_active");
  }
  if (record.count >= dailyCap) {
    throw new AdRewardGrantError("Daily reward cap reached", 429, "daily_cap_reached");
  }

  record.count += 1;
  record.lastGrantAtMs = nowMs;
  record.seenNonces.add(input.nonce);
  records.set(input.subscriberId, record);

  const granted = grantInventory({
    subscriberId: input.subscriberId,
    sku: input.sku,
    quantity: input.quantity,
    reason: "ad_reward"
  });

  return {
    ...granted,
    antiFraud: {
      dailyCount: record.count,
      dailyCap,
      cooldownSec
    }
  };
}

export function resetAdRewardStore() {
  records.clear();
}
