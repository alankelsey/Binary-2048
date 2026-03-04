import { createHmac, timingSafeEqual } from "crypto";
import { verifyAuthBridgeToken, type AuthBridgeClaims } from "@/lib/binary2048/auth-bridge";
import { resolveUserTier, type UserTier } from "@/lib/binary2048/security-policy";

type HeaderClaimsPayload = {
  sub: string;
  exp?: number;
  tier?: UserTier;
  isAuthenticated?: boolean;
  isPaid?: boolean;
  entitlements?: string[];
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

function sign(input: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(input).digest());
}

function parseBearerToken(authHeader: string | null): string {
  if (!authHeader) return "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function normalizeHeaderClaims(payload: HeaderClaimsPayload): AuthBridgeClaims | null {
  if (!payload || typeof payload.sub !== "string" || !payload.sub) return null;
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
    exp: typeof payload.exp === "number" ? payload.exp : Math.floor(Date.now() / 1000) + 60,
    tier,
    entitlements
  };
}

export function verifySignedHeaderClaims(
  headers: Headers,
  secret: string,
  nowMs = Date.now()
): AuthBridgeClaims | null {
  if (!secret) return null;
  const encodedClaims = headers.get("x-binary2048-auth-claims") ?? "";
  const signature = headers.get("x-binary2048-auth-sig") ?? "";
  if (!encodedClaims || !signature) return null;

  const expectedSig = sign(encodedClaims, secret);
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const raw = JSON.parse(fromBase64Url(encodedClaims).toString("utf8")) as HeaderClaimsPayload;
    const claims = normalizeHeaderClaims(raw);
    if (!claims) return null;
    if (typeof raw.exp === "number" && raw.exp * 1000 < nowMs) return null;
    return claims;
  } catch {
    return null;
  }
}

export function getVerifiedAuthClaims(req: Request): AuthBridgeClaims | null {
  const bearerToken = parseBearerToken(req.headers.get("authorization"));
  const bearerSecret = process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? "";
  const bearerClaims = verifyAuthBridgeToken(bearerToken, bearerSecret);
  if (bearerClaims) return bearerClaims;

  const headerSecret = process.env.BINARY2048_AUTH_HEADER_SECRET ?? "";
  const headerClaims = verifySignedHeaderClaims(req.headers, headerSecret);
  if (headerClaims) return headerClaims;

  return null;
}
