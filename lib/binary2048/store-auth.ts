import { createHash } from "crypto";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import type { UserTier } from "@/lib/binary2048/security-policy";

export function storeSubscriberIdForSubject(subject: string): string {
  return `acct_${createHash("sha256").update(subject).digest("hex")}`;
}

export function getStorePrincipal(req: Request): {
  subscriberId: string;
  tier: UserTier;
  entitlements: string[];
} | null {
  const claims = getVerifiedAuthClaims(req);
  if (!claims?.sub) return null;
  return {
    subscriberId: storeSubscriberIdForSubject(claims.sub),
    tier: claims.tier,
    entitlements: claims.entitlements
  };
}

export function hasStoreAdminToken(req: Request): boolean {
  const expected = process.env.BINARY2048_ADMIN_TOKEN ?? "";
  const provided = req.headers.get("x-admin-token") ?? "";
  return Boolean(expected && provided && provided === expected);
}
