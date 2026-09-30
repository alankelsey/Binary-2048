import { createHash } from "crypto";
import { isAdminRequest } from "@/lib/binary2048/admin-auth";
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

export function hasStoreAdminAuthority(req: Request): boolean {
  return isAdminRequest(req);
}
