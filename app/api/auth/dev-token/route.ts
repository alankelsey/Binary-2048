import { NextResponse } from "next/server";
import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { resolveUserTier, type UserTier } from "@/lib/binary2048/security-policy";

type DevTokenBody = {
  sub?: string;
  tier?: UserTier;
  isAuthenticated?: boolean;
  isPaid?: boolean;
  entitlements?: string[];
  ttlSeconds?: number;
};

const DEFAULT_TTL_SECONDS = 900;

function isEnabled(env: Record<string, string | undefined>) {
  return env.BINARY2048_ENABLE_DEV_AUTH_TOKEN === "1";
}

function parseTier(body: DevTokenBody): UserTier {
  if (body.tier === "guest" || body.tier === "authed" || body.tier === "paid") return body.tier;
  return resolveUserTier({
    isAuthenticated: Boolean(body.isAuthenticated ?? true),
    isPaid: Boolean(body.isPaid)
  });
}

function parseTtlSeconds(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_SECONDS;
  return Math.floor(parsed);
}

export async function POST(req: Request) {
  const authSecret = process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? "";
  if (!isEnabled(process.env)) {
    return NextResponse.json({ error: "Dev auth token endpoint is disabled" }, { status: 404 });
  }
  if (!authSecret) {
    return NextResponse.json({ error: "Auth bridge secret is not configured" }, { status: 503 });
  }

  const body = ((await req.json().catch(() => ({}))) as DevTokenBody);
  const tier = parseTier(body);
  const ttlSeconds = parseTtlSeconds(body.ttlSeconds);
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = createAuthBridgeToken(
    {
      sub: body.sub || "dev-user",
      exp,
      tier,
      entitlements: Array.isArray(body.entitlements) ? body.entitlements : []
    },
    authSecret
  );

  return NextResponse.json({
    token,
    exp,
    ttlSeconds,
    userTier: tier,
    entitlements: Array.isArray(body.entitlements) ? body.entitlements : []
  });
}
