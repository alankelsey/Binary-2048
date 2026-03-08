import { exportToCompactReplay } from "@/lib/binary2048/replay-format";
import type { CanonicalRunRecord } from "@/lib/binary2048/run-store";
import type { GameExport, SessionIntegrity } from "@/lib/binary2048/types";

type BuildRunRecordParams = {
  id: string;
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  exported: GameExport;
  integrity: SessionIntegrity;
  replaySignature?: string;
};

function getMaxTile(exported: GameExport) {
  let max = 0;
  for (const row of exported.final.grid) {
    for (const cell of row) {
      if (cell?.t !== "n") continue;
      max = Math.max(max, cell.v);
    }
  }
  return max;
}

export function buildCanonicalRunRecord(params: BuildRunRecordParams): CanonicalRunRecord {
  const { exported } = params;
  const replay = exportToCompactReplay(exported);
  return {
    id: params.id,
    playerId: params.playerId,
    userTier: params.userTier,
    gameId: params.gameId,
    score: exported.final.score,
    maxTile: getMaxTile(exported),
    moves: exported.final.turn,
    seed: replay.header.seed,
    engineVersion: replay.header.engineVersion,
    rulesetId: replay.header.rulesetId,
    integrity: params.integrity,
    createdAtISO: exported.meta?.createdAtISO ?? new Date().toISOString(),
    replaySignature: params.replaySignature,
    replay
  };
}
