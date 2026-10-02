import type { Collection } from "mongodb";
import { sharedMongoDb } from "@/lib/binary2048/shared-mongo";
import type { GameSession } from "@/lib/binary2048/types";

export class SessionConflictError extends Error {
  constructor() { super("Session changed; refresh and retry"); this.name = "SessionConflictError"; }
}

export type SessionStore = {
  set: (id: string, session: GameSession) => Promise<void>;
  get: (id: string) => Promise<GameSession | null>;
  delete: (id: string) => Promise<void>;
};

type SessionDocument = { id: string; session: GameSession; revision: number; expiresAt: Date };
const versions = new WeakMap<GameSession, number>();
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionDocument>();
  async set(id: string, session: GameSession) {
    const existing = this.sessions.get(id);
    if (existing && versions.get(session) !== existing.revision) throw new SessionConflictError();
    const revision = (existing?.revision ?? 0) + 1;
    this.sessions.set(id, { id, session: copy(session), revision, expiresAt: expiry() });
    versions.set(session, revision);
  }
  async get(id: string) {
    const found = this.sessions.get(id);
    if (!found || found.expiresAt.getTime() <= Date.now()) return null;
    const session = copy(found.session);
    versions.set(session, found.revision);
    return session;
  }
  async delete(id: string) { this.sessions.delete(id); }
}

function expiry() { return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); }

export class MongoSessionStore implements SessionStore {
  private ready?: Promise<Collection<SessionDocument>>;
  constructor(private readonly collectionFactory = async () =>
    (await sharedMongoDb()).collection<SessionDocument>(process.env.BINARY2048_MONGO_SESSION_COLLECTION ?? "sessions")) {}
  private collection() {
    if (!this.ready) this.ready = this.collectionFactory().then(async (collection) => {
      await collection.createIndexes([
        { key: { id: 1 }, name: "uniq_session_id", unique: true },
        { key: { expiresAt: 1 }, name: "session_expiry", expireAfterSeconds: 0 }
      ]);
      return collection;
    }).catch(() => { this.ready = undefined; throw new Error("Session storage is temporarily unavailable"); });
    return this.ready;
  }
  async get(id: string) {
    const found = await (await this.collection()).findOne({ id });
    if (!found) return null;
    if (found.expiresAt && found.expiresAt.getTime() <= Date.now()) {
      await (await this.collection()).deleteOne({ id, expiresAt: { $lte: new Date() } });
      return null;
    }
    const session = found.session;
    versions.set(session, found.revision ?? 0);
    return session;
  }
  async set(id: string, session: GameSession) {
    const collection = await this.collection();
    const expected = versions.get(session);
    const revision = (expected ?? 0) + 1;
    const document = { id, session, revision, expiresAt: expiry() };
    if (expected === undefined) {
      try { await collection.insertOne(document); }
      catch (error) {
        if ((error as { code?: number }).code === 11000) throw new SessionConflictError();
        throw new Error("Session storage is temporarily unavailable");
      }
    } else {
      const filter = expected === 0 ? { id, revision: { $exists: false as const } } : { id, revision: expected };
      const result = await collection.replaceOne(filter, document);
      if (!result.matchedCount) throw new SessionConflictError();
    }
    versions.set(session, revision);
  }
  async delete(id: string) { await (await this.collection()).deleteOne({ id }); }
}

/** Preserve the read revision when replacing a trusted recovery snapshot. */
export function inheritSessionRevision(target: GameSession, source: GameSession | null) {
  const revision = source ? versions.get(source) : undefined;
  if (revision !== undefined) versions.set(target, revision);
  else versions.delete(target);
}

const globalStore = globalThis as typeof globalThis & { __binary2048_session_store?: SessionStore };
export function getSessionStore(): SessionStore {
  if (!globalStore.__binary2048_session_store) {
    const mode = (process.env.BINARY2048_SESSION_STORE ?? process.env.BINARY2048_RUN_STORE ?? "memory").toLowerCase();
    if (mode === "mongo" && !process.env.BINARY2048_MONGO_URI) {
      throw new Error("BINARY2048_MONGO_URI is required when BINARY2048_SESSION_STORE=mongo");
    }
    globalStore.__binary2048_session_store = mode === "mongo" ? new MongoSessionStore() : new MemorySessionStore();
  }
  return globalStore.__binary2048_session_store;
}
export function resetSessionStoreForTests() { delete globalStore.__binary2048_session_store; }
