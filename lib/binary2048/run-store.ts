import type { CompactReplayPayload } from "@/lib/binary2048/replay-format";
import { getReplayArtifactStore, type ReplayArtifactRef } from "@/lib/binary2048/replay-artifact-store";
import type { SessionIntegrity } from "@/lib/binary2048/types";
import { MongoClient } from "mongodb";

export type CanonicalRunRecord = {
  id: string;
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  contestId?: string;
  score: number;
  maxTile: number;
  moves: number;
  seed: number;
  engineVersion: string;
  rulesetId: string;
  integrity: SessionIntegrity;
  createdAtISO: string;
  replaySignature?: string;
  replay?: CompactReplayPayload;
  replayRef?: ReplayArtifactRef;
};

export type RunStore = {
  upsertRun: (record: CanonicalRunRecord) => Promise<void>;
  getRun: (id: string) => Promise<CanonicalRunRecord | null>;
  getRunReplay: (id: string) => Promise<CompactReplayPayload | null>;
};

export type RunIndexSpec = {
  key: Record<string, 1 | -1>;
  name: string;
};

export const RUN_INDEX_SPECS: RunIndexSpec[] = [
  { name: "uniq_run_id", key: { id: 1 } },
  { name: "player_created_desc", key: { playerId: 1, createdAtISO: -1 } },
  { name: "ruleset_score_desc", key: { rulesetId: 1, score: -1, createdAtISO: -1 } },
  { name: "contest_score_desc", key: { contestId: 1, score: -1, createdAtISO: -1 } }
];

class MemoryRunStore implements RunStore {
  private readonly runs = new Map<string, CanonicalRunRecord>();

  async upsertRun(record: CanonicalRunRecord) {
    this.runs.set(record.id, record);
  }

  async getRun(id: string) {
    return this.runs.get(id) ?? null;
  }

  async getRunReplay(id: string) {
    return this.runs.get(id)?.replay ?? null;
  }
}

class MongoRunStore implements RunStore {
  private readonly uri: string;
  private readonly dbName: string;
  private readonly collectionName: string;
  private clientPromise: Promise<{
    collection: {
      updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>, opts: Record<string, unknown>) => Promise<unknown>;
      findOne: (filter: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      createIndexes: (indexes: Array<{ key: Record<string, 1 | -1>; name: string; unique?: boolean }>) => Promise<unknown>;
    };
  }> | null = null;

  constructor(uri: string, dbName: string, collectionName: string) {
    this.uri = uri;
    this.dbName = dbName;
    this.collectionName = collectionName;
  }

  private async getCollection() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const client = new MongoClient(this.uri);
        await client.connect();
        const db = client.db(this.dbName);
        const collection = db.collection(this.collectionName);
        await collection.createIndexes(
          RUN_INDEX_SPECS.map((index) => ({
            key: index.key,
            name: index.name,
            unique: index.name === "uniq_run_id"
          }))
        );
        return {
          collection
        };
      })();
    }
    return this.clientPromise!;
  }

  async upsertRun(record: CanonicalRunRecord) {
    const artifactStore = getReplayArtifactStore();
    const toPersist: CanonicalRunRecord = { ...record };
    if (record.replay) {
      const replayRef = await artifactStore.persistIfConfigured(record.id, record.replay, {
        score: record.score,
        contestId: record.contestId
      });
      if (replayRef.kind === "s3") {
        toPersist.replayRef = replayRef;
        delete toPersist.replay;
      }
    }

    const { collection } = await this.getCollection();
    await collection.updateOne(
      { id: record.id },
      { $set: toPersist },
      { upsert: true }
    );
  }

  async getRun(id: string) {
    const { collection } = await this.getCollection();
    const found = await collection.findOne({ id });
    return found as CanonicalRunRecord | null;
  }

  async getRunReplay(id: string) {
    const found = await this.getRun(id);
    if (!found) return null;
    if (found.replay) return found.replay;
    if (found.replayRef) {
      return getReplayArtifactStore().load(found.replayRef);
    }
    return null;
  }
}

const globalStore = globalThis as typeof globalThis & {
  __binary2048_run_store?: RunStore;
};

function createRunStore(): RunStore {
  const mode = (process.env.BINARY2048_RUN_STORE ?? "memory").toLowerCase();
  if (mode === "mongo") {
    const uri = process.env.BINARY2048_MONGO_URI ?? "";
    if (!uri) {
      throw new Error("BINARY2048_MONGO_URI is required when BINARY2048_RUN_STORE=mongo");
    }
    const dbName = process.env.BINARY2048_MONGO_DB ?? "binary2048";
    const collectionName = process.env.BINARY2048_MONGO_RUN_COLLECTION ?? "runs";
    return new MongoRunStore(uri, dbName, collectionName);
  }
  return new MemoryRunStore();
}

export function getRunStore(): RunStore {
  if (!globalStore.__binary2048_run_store) {
    globalStore.__binary2048_run_store = createRunStore();
  }
  return globalStore.__binary2048_run_store;
}

export function resetRunStoreForTests() {
  delete globalStore.__binary2048_run_store;
}
