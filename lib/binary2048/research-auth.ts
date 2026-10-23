import { createHash } from "crypto";
import { getAdminAuthority } from "@/lib/binary2048/admin-auth";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";
import { resolveBotApiKey } from "@/lib/binary2048/bot-api-key";

export const RESEARCH_SCOPES = [
  "simulation:run",
  "tournament:run",
  "training:read",
  "replay:ingest",
  "jobs:read"
] as const;

export type ResearchScope = (typeof RESEARCH_SCOPES)[number];
export type ResearchAuthority = {
  principal: string;
  kind: "api-key" | "research-subject" | "admin";
  admin: boolean;
};

export type ResearchAuthorization =
  | { allowed: true; authority: ResearchAuthority }
  | { allowed: false; status: 401 | 403; error: string };

function configuredSubjects(raw = process.env.BINARY2048_RESEARCH_SUBJECTS): Set<string> {
  return new Set((raw ?? "").split(/[\n,]/).map((value) => value.trim()).filter(Boolean));
}

function configuredScopes(raw = process.env.BINARY2048_BOT_API_KEY_SCOPES): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const item of (raw ?? "").split(",")) {
    const separator = item.indexOf("=");
    if (separator <= 0) continue;
    const id = item.slice(0, separator).trim();
    const scopes = item.slice(separator + 1).split("|").map((scope) => scope.trim()).filter(Boolean);
    if (id && scopes.length) result.set(id, new Set(scopes));
  }
  return result;
}

function subjectPrincipal(subject: string): string {
  return `subject:${createHash("sha256").update(subject).digest("hex")}`;
}

export function authorizeResearchRequest(req: Request, requiredScope: ResearchScope): ResearchAuthorization {
  const admin = getAdminAuthority(req);
  if (admin) {
    const principal = admin.kind === "service-token" ? "admin:service" : subjectPrincipal(admin.subject);
    return { allowed: true, authority: { principal, kind: "admin", admin: true } };
  }

  const claims = getVerifiedAuthClaims(req);
  if (claims && configuredSubjects().has(claims.sub)) {
    return {
      allowed: true,
      authority: { principal: subjectPrincipal(claims.sub), kind: "research-subject", admin: false }
    };
  }

  const presentedKey = req.headers.get("x-api-key");
  const apiKey = resolveBotApiKey(presentedKey);
  if (!apiKey) {
    return { allowed: false, status: 401, error: "Valid scoped research credential required" };
  }
  const scopes = configuredScopes().get(apiKey.id);
  if (!scopes?.has(requiredScope) && !scopes?.has("research:*")) {
    return { allowed: false, status: 403, error: `Research credential lacks ${requiredScope} scope` };
  }
  return {
    allowed: true,
    authority: { principal: `api-key:${apiKey.id}`, kind: "api-key", admin: false }
  };
}
