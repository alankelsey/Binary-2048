import { createHmac, timingSafeEqual } from "crypto";
import { resolveUserTier, type UserTier } from "@/lib/binary2048/security-policy";

type AuthBridgePayload = {
  sub: string;
  exp: number;
  tier?: UserTier;
  isAuthenticated?: boolean;
  isPaid?: boolean;
  entitlements?: string[];
};

export type AuthBridgeClaims = {
  sub: string;
  exp: number;
  tier: UserTier;
  entitlements: string[];
};

function toBase64Url(input: Buffer | string): string {
  const base64 = (Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8")).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sign(data: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(data).digest());
}

function normalizeClaims(payload: AuthBridgePayload): AuthBridgeClaims | null {
  if (!payload || typeof payload.sub !== "string" || !payload.sub) return null;
  if (typeof payload.exp !== "number") return null;

  const tier =
    payload.tier === "guest" || payload.tier === "authed" || payload.tier === "paid"
      ? payload.tier
      : resolveUserTier({
          isAuthenticated: Boolean(payload.isAuthenticated ?? true),
          isPaid: Boolean(payload.isPaid)
        });

  const entitlements = Array.isArray(payload.entitlements)
    ? payload.entitlements.filter((item) => typeof item === "string")
    : [];

  return {
    sub: payload.sub,
    exp: payload.exp,
    tier,
    entitlements
  };
}

export function createAuthBridgeToken(payload: AuthBridgePayload, secret: string): string {
  const body = toBase64Url(JSON.stringify(payload));
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifyAuthBridgeToken(token: string | null | undefined, secret: string, nowMs = Date.now()) {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expectedSig = sign(body, secret);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const raw = JSON.parse(fromBase64Url(body).toString("utf8")) as AuthBridgePayload;
    const claims = normalizeClaims(raw);
    if (!claims) return null;
    if (claims.exp * 1000 < nowMs) return null;
    return claims;
  } catch {
    return null;
  }
}
