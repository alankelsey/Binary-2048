import type { GameSession } from "@/lib/binary2048/types";

export type SessionStore = {
  set: (id: string, session: GameSession) => void;
  get: (id: string) => GameSession | null;
  delete: (id: string) => void;
};

class MemorySessionStore implements SessionStore {
  protected readonly sessions = new Map<string, GameSession>();

  set(id: string, session: GameSession) {
    this.sessions.set(id, session);
  }

  get(id: string) {
    return this.sessions.get(id) ?? null;
  }

  delete(id: string) {
    this.sessions.delete(id);
  }
}

type MongoCollectionLike = {
  updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>, opts: Record<string, unknown>) => Promise<unknown>;
  findOne: (filter: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  createIndexes: (indexes: Array<{ key: Record<string, 1 | -1>; name: string; unique?: boolean }>) => Promise<unknown>;
};

class MongoSessionStore extends MemorySessionStore {
  private readonly uri: string;
  private readonly dbName: string;
  private readonly collectionName: string;
  private collectionPromise: Promise<MongoCollectionLike> | null = null;
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(uri: string, dbName: string, collectionName: string) {
    super();
    this.uri = uri;
    this.dbName = dbName;
    this.collectionName = collectionName;
  }

  private async getCollection() {
    if (!this.collectionPromise) {
      this.collectionPromise = (async () => {
        const dynamicImport = new Function("m", "return import(m)") as (moduleName: string) => Promise<{
          MongoClient: new (uri: string) => {
            connect: () => Promise<void>;
            db: (name: string) => {
              collection: (name: string) => MongoCollectionLike;
            };
          };
        }>;
        const mongodb = await dynamicImport("mongodb");
        const client = new mongodb.MongoClient(this.uri);
        await client.connect();
        const collection = client.db(this.dbName).collection(this.collectionName);
        await collection.createIndexes([
          { name: "uniq_session_id", key: { id: 1 }, unique: true },
          { name: "session_updated_desc", key: { updatedAtISO: -1 } }
        ]);
        return collection;
      })();
    }
    return this.collectionPromise;
  }

  private persist(id: string, session: GameSession) {
    const previous = this.inFlight.get(id) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const collection = await this.getCollection();
        await collection.updateOne(
          { id },
          {
            $set: {
              id,
              session,
              updatedAtISO: new Date().toISOString()
            }
          },
          { upsert: true }
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (this.inFlight.get(id) === next) {
          this.inFlight.delete(id);
        }
      });
    this.inFlight.set(id, next);
  }

  override set(id: string, session: GameSession) {
    super.set(id, session);
    this.persist(id, session);
  }

  override get(id: string) {
    const cached = super.get(id);
    if (cached) return cached;
    void this.hydrate(id);
    return null;
  }

  private async hydrate(id: string) {
    const collection = await this.getCollection();
    const found = await collection.findOne({ id });
    const session = (found?.session as GameSession | undefined) ?? null;
    if (session) {
      super.set(id, session);
    }
  }
}

const globalStore = globalThis as typeof globalThis & {
  __binary2048_session_store?: SessionStore;
};

function createSessionStore(): SessionStore {
  const mode = (process.env.BINARY2048_SESSION_STORE ?? process.env.BINARY2048_RUN_STORE ?? "memory").toLowerCase();
  if (mode === "mongo") {
    const uri = process.env.BINARY2048_MONGO_URI ?? "";
    if (!uri) {
      throw new Error("BINARY2048_MONGO_URI is required when BINARY2048_SESSION_STORE=mongo");
    }
    const dbName = process.env.BINARY2048_MONGO_DB ?? "binary2048";
    const collectionName = process.env.BINARY2048_MONGO_SESSION_COLLECTION ?? "sessions";
    return new MongoSessionStore(uri, dbName, collectionName);
  }
  return new MemorySessionStore();
}

export function getSessionStore() {
  if (!globalStore.__binary2048_session_store) {
    globalStore.__binary2048_session_store = createSessionStore();
  }
  return globalStore.__binary2048_session_store;
}

export function resetSessionStoreForTests() {
  delete globalStore.__binary2048_session_store;
}

