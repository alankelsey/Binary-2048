import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import type { UserTier } from "@/lib/binary2048/security-policy";

type BridgeBody = {
  ttlSeconds?: number;
};

function normalizeTier(raw: unknown): UserTier {
  return raw === "paid" || raw === "guest" || raw === "authed" ? raw : "authed";
}

export async function POST(req: Request) {
  const secret = process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? "";
  if (!secret) {
    return NextResponse.json(
      { error: "Auth bridge secret is not configured" },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  const user = session?.user;
  const sub = user?.email || user?.name;
  if (!sub) {
    return NextResponse.json({ error: "Authenticated session required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as BridgeBody;
  const ttlSeconds = Number.isFinite(Number(body.ttlSeconds))
    ? Math.max(30, Math.min(3600, Math.floor(Number(body.ttlSeconds))))
    : 300;

  const sessionExtra = (session as unknown as Record<string, unknown>) ?? {};
  const tier = normalizeTier(sessionExtra.tier);
  const entitlements = Array.isArray(sessionExtra.entitlements)
    ? ((sessionExtra.entitlements as unknown[]).filter(
        (item): item is string => typeof item === "string"
      ) as string[])
    : [];

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = createAuthBridgeToken(
    {
      sub,
      exp,
      tier,
      entitlements,
      isAuthenticated: true,
      isPaid: tier === "paid"
    },
    secret
  );

  return NextResponse.json(
    {
      token,
      exp,
      ttlSeconds,
      userTier: tier,
      entitlements
    },
    { status: 200 }
  );
}
