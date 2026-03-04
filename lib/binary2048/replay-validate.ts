import { runReplay } from "@/lib/binary2048/replay-run";
import { toCompactReplayPayload } from "@/lib/binary2048/replay-format";
import { verifyReplaySignature } from "@/lib/binary2048/replay-signature";

export type ReplayValidationResult = {
  ok: boolean;
  reason: string;
  details?: {
    rulesetId: string;
    replayVersion: number;
    engineVersion: string;
    moves: number;
    finalStateHash: string;
    totalScore: number;
    movesApplied: number;
  };
};

type ReplayValidationOptions = {
  signature?: string;
  signingSecret?: string;
};

export function validateReplay(payload: unknown, options?: ReplayValidationOptions): ReplayValidationResult {
  try {
    const compact = toCompactReplayPayload(payload);
    if (typeof options?.signature === "string") {
      if (!options.signingSecret) {
        return { ok: false, reason: "Replay signature cannot be verified (missing secret)" };
      }
      if (!verifyReplaySignature(compact, options.signature, options.signingSecret)) {
        return { ok: false, reason: "Invalid replay signature" };
      }
    }
    if (compact.header.rulesetId !== "binary2048-v1") {
      return { ok: false, reason: `Unsupported rulesetId: ${compact.header.rulesetId}` };
    }

    const runA = runReplay(compact);
    const runB = runReplay(compact);
    const deterministic =
      runA.finalStateHash === runB.finalStateHash &&
      runA.totalScore === runB.totalScore &&
      runA.movesApplied === runB.movesApplied;

    if (!deterministic) {
      return { ok: false, reason: "Deterministic rerun mismatch" };
    }

    return {
      ok: true,
      reason: "OK",
      details: {
        rulesetId: compact.header.rulesetId,
        replayVersion: compact.header.replayVersion,
        engineVersion: compact.header.engineVersion,
        moves: compact.moves.length,
        finalStateHash: runA.finalStateHash,
        totalScore: runA.totalScore,
        movesApplied: runA.movesApplied
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Invalid replay payload"
    };
  }
}
