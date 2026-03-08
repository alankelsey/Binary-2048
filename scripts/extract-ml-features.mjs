#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const input = process.env.IN ?? "data/runs-dataset.jsonl";
const output = process.env.OUT ?? "data/runs-features.jsonl";

function actionEntropyApprox(moves) {
  if (!Array.isArray(moves) || moves.length === 0) return 0;
  const counts = new Map();
  for (const move of moves) counts.set(move, (counts.get(move) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / moves.length;
    entropy += -p * Math.log2(p);
  }
  return Number(entropy.toFixed(6));
}

function tierToNumeric(tier) {
  if (tier === "paid") return 2;
  if (tier === "authed") return 1;
  return 0;
}

function extract(row) {
  const moves = row?.replay?.moves ?? [];
  const moveCount = Math.max(1, Number(row.moves) || moves.length || 1);
  const boardSize = Math.max(2, Number(row?.replay?.header?.size ?? 4));
  return {
    runId: row.runId,
    labelScore: Number(row.score ?? 0),
    labelMaxTile: Number(row.maxTile ?? 0),
    f_moves: Number(row.moves ?? 0),
    f_scorePerMove: Number(((Number(row.score ?? 0)) / moveCount).toFixed(6)),
    f_maxTilePerMove: Number(((Number(row.maxTile ?? 0)) / moveCount).toFixed(6)),
    f_actionEntropyApprox: actionEntropyApprox(moves),
    f_boardSize: boardSize,
    f_tier: tierToNumeric(row.userTier)
  };
}

try {
  const raw = await readFile(input, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const featureLines = lines.map((line) => JSON.stringify(extract(line)));
  await writeFile(output, `${featureLines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, input, output, count: featureLines.length }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
