import { createHmac, timingSafeEqual } from "crypto";

type EntitlementProofPayload = {
  entitlements: string[];
  exp: number;
};

function toBase64Url(input: Buffer | string): string {
  const base64 = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(input, "utf8").toString("base64");
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

export function createEntitlementProof(payload: EntitlementProofPayload, secret: string): string {
  const body = toBase64Url(JSON.stringify(payload));
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifyEntitlementProof(
  proof: string | undefined,
  secret: string,
  nowMs = Date.now()
): string[] {
  if (!proof || !secret) return [];
  const [body, sig] = proof.split(".");
  if (!body || !sig) return [];

  const expectedSig = sign(body, secret);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return [];

  try {
    const payload = JSON.parse(fromBase64Url(body).toString("utf8")) as EntitlementProofPayload;
    if (!payload || !Array.isArray(payload.entitlements) || typeof payload.exp !== "number") return [];
    if (payload.exp * 1000 < nowMs) return [];
    return payload.entitlements.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
}
