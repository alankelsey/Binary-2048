#!/usr/bin/env node

const uri = process.env.BINARY2048_MONGO_URI ?? "";
const dbName = process.env.BINARY2048_MONGO_DB ?? "binary2048";
const collectionName = process.env.BINARY2048_MONGO_RUN_COLLECTION ?? "runs";

if (!uri) {
  console.error("BINARY2048_MONGO_URI is required");
  process.exit(1);
}

const { MongoClient } = await import("mongodb");
const client = new MongoClient(uri);

const now = new Date().toISOString();
const runId = `smoke_${Date.now()}`;

try {
  await client.connect();
  const db = client.db(dbName);
  await db.command({ ping: 1 });
  const collection = db.collection(collectionName);
  const sample = {
    id: runId,
    playerId: "mongo_smoke",
    userTier: "authed",
    gameId: "g_smoke",
    score: 1,
    maxTile: 1,
    moves: 1,
    seed: 1,
    engineVersion: "smoke",
    rulesetId: "binary2048-v1",
    integrity: { sessionClass: "ranked", source: "created" },
    createdAtISO: now,
    replay: {
      header: {
        replayVersion: 1,
        rulesetId: "binary2048-v1",
        engineVersion: "smoke",
        size: 4,
        seed: 1,
        createdAt: now
      },
      config: {
        width: 4,
        height: 4,
        seed: 1,
        winTile: 2048,
        zeroBehavior: "annihilate",
        spawnOnNoopMove: false,
        spawn: { pZero: 0.15, pOne: 0.72, pWildcard: 0.1, pLock: 0.03, wildcardMultipliers: [2] }
      },
      initialGrid: Array.from({ length: 4 }, () => [null, null, null, null]),
      moves: ["L"]
    }
  };

  await collection.updateOne({ id: runId }, { $set: sample }, { upsert: true });
  const found = await collection.findOne({ id: runId });
  await collection.deleteOne({ id: runId });

  if (!found) {
    throw new Error("Smoke write/read check failed");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dbName,
        collectionName,
        runId
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.close().catch(() => undefined);
}
