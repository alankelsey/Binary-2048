import { simulateBatch, type SimulateBatchRequest, type SimulateBatchResult } from "@/lib/binary2048/simulate";
import { toCompactReplayPayload } from "@/lib/binary2048/replay-format";

export function runReplay(payload: unknown): SimulateBatchResult {
  const compact = toCompactReplayPayload(payload);
  if (compact.header.rulesetId !== "binary2048-v1") {
    throw new Error(`Unsupported rulesetId: ${compact.header.rulesetId}`);
  }
  const request: SimulateBatchRequest = {
    seed: compact.header.seed,
    moves: compact.moves,
    config: compact.config,
    initialGrid: compact.initialGrid,
    includeSteps: true
  };
  return simulateBatch(request);
}
