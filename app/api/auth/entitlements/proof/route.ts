import { NextResponse } from "next/server";
import { verifyAuthBridgeToken } from "@/lib/binary2048/auth-bridge";
import { deriveEntitlementsForTier } from "@/lib/binary2048/entitlements";
import { createEntitlementProof } from "@/lib/binary2048/entitlement-proof";

type ProofBody = {
  sessionClass?: "ranked" | "unranked";
};

const DEFAULT_TTL_SECONDS = 300;

function parseBearerToken(authHeader: string | null): string {
  if (!authHeader) return "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export async function POST(req: Request) {
  const authSecret = process.env.BINARY2048_AUTH_BRIDGE_SECRET ?? "";
  const proofSecret = process.env.BINARY2048_ENTITLEMENT_SECRET ?? "";
  if (!authSecret || !proofSecret) {
    return NextResponse.json(
      { error: "Proof issuance is not configured on server" },
      { status: 503 }
    );
  }

  const token = parseBearerToken(req.headers.get("authorization"));
  const claims = verifyAuthBridgeToken(token, authSecret);
  if (!claims) {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }
  if (claims.tier === "guest") {
    return NextResponse.json({ error: "Authenticated user required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as ProofBody));
  const sessionClass = body?.sessionClass === "unranked" ? "unranked" : "ranked";
  const entitlements = deriveEntitlementsForTier(claims.tier, claims.entitlements);

  const ttlSeconds = Number(process.env.BINARY2048_ENTITLEMENT_PROOF_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  const expiresAt = Math.floor(Date.now() / 1000) + (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS);
  const proof = createEntitlementProof(
    {
      entitlements,
      exp: expiresAt
    },
    proofSecret
  );

  return NextResponse.json({
    proof,
    exp: expiresAt,
    sessionClass,
    userTier: claims.tier,
    entitlements
  });
}
