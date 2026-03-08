#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

const uri = process.env.BINARY2048_MONGO_URI ?? "";
const dbName = process.env.BINARY2048_MONGO_DB ?? "binary2048";
const collectionName = process.env.BINARY2048_MONGO_RUN_COLLECTION ?? "runs";
const out = process.env.OUT ?? "data/runs-dataset.jsonl";
const anonSalt = process.env.BINARY2048_DATASET_SALT ?? "binary2048";
const limit = Number(process.env.LIMIT ?? "5000");

if (!uri) {
  console.error("BINARY2048_MONGO_URI is required");
  process.exit(1);
}

const { MongoClient } = await import("mongodb");
const client = new MongoClient(uri);

function anonPlayerId(playerId) {
  return createHash("sha256").update(`${anonSalt}:${playerId}`).digest("hex").slice(0, 24);
}

try {
  await client.connect();
  const collection = client.db(dbName).collection(collectionName);
  const docs = await collection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .limit(Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5000)
    .toArray();

  const lines = docs.map((doc) =>
    JSON.stringify({
      runId: doc.id,
      anonPlayerId: anonPlayerId(doc.playerId ?? "unknown"),
      userTier: doc.userTier ?? "guest",
      score: doc.score ?? 0,
      maxTile: doc.maxTile ?? 0,
      moves: doc.moves ?? 0,
      seed: doc.seed ?? 0,
      rulesetId: doc.rulesetId ?? "binary2048-v1",
      engineVersion: doc.engineVersion ?? "unknown",
      createdAtISO: doc.createdAtISO ?? new Date(0).toISOString(),
      replay: {
        header: doc.replay?.header ?? null,
        moves: Array.isArray(doc.replay?.moves) ? doc.replay.moves : []
      }
    })
  );

  await writeFile(out, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, out, count: lines.length }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => undefined);
}
