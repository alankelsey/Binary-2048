import { createHmac, timingSafeEqual } from "crypto";
import type { SessionRecoverySnapshot } from "@/lib/binary2048/types";

function unsignedPayload(snapshot: SessionRecoverySnapshot) {
  return {
    recoveryVersion: snapshot.recoveryVersion,
    rulesetId: snapshot.rulesetId,
    sessionId: snapshot.sessionId ?? null,
    config: snapshot.config,
    initialGrid: snapshot.initialGrid,
    moves: snapshot.moves,
    integrity: snapshot.integrity ?? null,
    undo: snapshot.undo ?? null
  };
}

export function createRecoverySignature(
  snapshot: SessionRecoverySnapshot,
  secret: string
): string {
  if (!secret) throw new Error("Recovery signing secret is not configured");
  return createHmac("sha256", secret)
    .update(JSON.stringify(unsignedPayload(snapshot)))
    .digest("base64url");
}

export function verifyRecoverySignature(
  snapshot: SessionRecoverySnapshot,
  secret: string
): boolean {
  if (!snapshot.signature || !secret) return false;
  const expected = createRecoverySignature(snapshot, secret);
  const actualBuffer = Buffer.from(snapshot.signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
