type DatasetReplayHeader = {
  size?: number;
};

type DatasetRow = {
  runId: string;
  anonPlayerId: string;
  userTier: "guest" | "authed" | "paid";
  score: number;
  maxTile: number;
  moves: number;
  seed: number;
  rulesetId: string;
  engineVersion: string;
  replay?: {
    header?: DatasetReplayHeader | null;
    moves?: string[];
  };
};

export type MlFeatureRow = {
  runId: string;
  labelScore: number;
  labelMaxTile: number;
  f_moves: number;
  f_scorePerMove: number;
  f_maxTilePerMove: number;
  f_actionEntropyApprox: number;
  f_boardSize: number;
  f_tier: 0 | 1 | 2;
};

function tierToNumeric(tier: DatasetRow["userTier"]): 0 | 1 | 2 {
  if (tier === "paid") return 2;
  if (tier === "authed") return 1;
  return 0;
}

function actionEntropyApprox(moves: string[]) {
  if (moves.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const move of moves) {
    counts.set(move, (counts.get(move) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / moves.length;
    entropy += -p * Math.log2(p);
  }
  return Number(entropy.toFixed(6));
}

export function extractMlFeatures(row: DatasetRow): MlFeatureRow {
  const moves = row.replay?.moves ?? [];
  const moveCount = Math.max(1, row.moves || moves.length || 1);
  const boardSize = Math.max(2, Number(row.replay?.header?.size ?? 4));
  return {
    runId: row.runId,
    labelScore: row.score,
    labelMaxTile: row.maxTile,
    f_moves: row.moves,
    f_scorePerMove: Number((row.score / moveCount).toFixed(6)),
    f_maxTilePerMove: Number((row.maxTile / moveCount).toFixed(6)),
    f_actionEntropyApprox: actionEntropyApprox(moves),
    f_boardSize: boardSize,
    f_tier: tierToNumeric(row.userTier)
  };
}
