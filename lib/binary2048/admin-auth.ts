import { createHash, timingSafeEqual } from "crypto";
import { getVerifiedAuthClaims } from "@/lib/binary2048/auth-context";

export type AdminAuthority =
  | { kind: "service-token" }
  | { kind: "subject-allowlist"; subject: string };

type AdminEnvironment = {
  BINARY2048_ADMIN_TOKEN?: string;
  BINARY2048_ADMIN_SUBJECTS?: string;
};

function deployedAdminEnvironment(): AdminEnvironment {
  return {
    BINARY2048_ADMIN_TOKEN: process.env.BINARY2048_ADMIN_TOKEN,
    BINARY2048_ADMIN_SUBJECTS: process.env.BINARY2048_ADMIN_SUBJECTS
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  if (!left || !right) return false;
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function configuredAdminSubjects(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\n,]/)
      .map((subject) => subject.trim())
      .filter(Boolean)
  );
}

export function isAdminSubject(subject: string | null | undefined, env: AdminEnvironment = deployedAdminEnvironment()): boolean {
  return Boolean(subject) && configuredAdminSubjects(env.BINARY2048_ADMIN_SUBJECTS).has(subject!);
}

export function getAdminAuthority(req: Request, env: AdminEnvironment = deployedAdminEnvironment()): AdminAuthority | null {
  const configuredToken = env.BINARY2048_ADMIN_TOKEN ?? "";
  const providedToken = req.headers.get("x-admin-token") ?? "";
  if (constantTimeEqual(configuredToken, providedToken)) return { kind: "service-token" };

  const claims = getVerifiedAuthClaims(req);
  if (claims && isAdminSubject(claims.sub, env)) {
    return { kind: "subject-allowlist", subject: claims.sub };
  }
  return null;
}

export function isAdminRequest(req: Request, env: AdminEnvironment = deployedAdminEnvironment()): boolean {
  return getAdminAuthority(req, env) !== null;
}
