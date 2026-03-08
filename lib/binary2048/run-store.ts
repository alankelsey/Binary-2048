import type { CompactReplayPayload } from "@/lib/binary2048/replay-format";
import type { SessionIntegrity } from "@/lib/binary2048/types";

export type CanonicalRunRecord = {
  id: string;
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  score: number;
  maxTile: number;
  moves: number;
  seed: number;
  engineVersion: string;
  rulesetId: string;
  integrity: SessionIntegrity;
  createdAtISO: string;
  replaySignature?: string;
  replay: CompactReplayPayload;
};

export type RunStore = {
  upsertRun: (record: CanonicalRunRecord) => Promise<void>;
  getRun: (id: string) => Promise<CanonicalRunRecord | null>;
  getRunReplay: (id: string) => Promise<CompactReplayPayload | null>;
};

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
        const dynamicImport = new Function("m", "return import(m)") as (moduleName: string) => Promise<{
          MongoClient: new (uri: string) => { connect: () => Promise<void>; db: (name: string) => { collection: (name: string) => { updateOne: (...args: unknown[]) => Promise<unknown>; findOne: (...args: unknown[]) => Promise<Record<string, unknown> | null> } } };
        }>;
        const mongodb = await dynamicImport("mongodb");
        const client = new mongodb.MongoClient(this.uri);
        await client.connect();
        const db = client.db(this.dbName);
        return {
          collection: db.collection(this.collectionName)
        };
      })();
    }
    return this.clientPromise;
  }

  async upsertRun(record: CanonicalRunRecord) {
    const { collection } = await this.getCollection();
    await collection.updateOne(
      { id: record.id },
      { $set: record },
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
    return found?.replay ?? null;
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
