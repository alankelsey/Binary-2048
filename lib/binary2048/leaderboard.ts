import { stateHash } from "@/lib/binary2048/ai";
import type { GameSession } from "@/lib/binary2048/types";
import { MongoClient, type Collection, type Filter } from "mongodb";

export type LeaderboardEntry = {
  id: string;
  namespace: "production" | "sandbox";
  isSandbox: boolean;
  isPractice: boolean;
  seasonMode: "live" | "preview";
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  score: number;
  moves: number;
  maxTile: number;
  stateHash: string;
  rulesetId: string;
  replaySignature?: string;
  submittedAtISO: string;
};

type SubmitLeaderboardParams = {
  namespace?: "production" | "sandbox";
  isSandbox?: boolean;
  isPractice?: boolean;
  seasonMode?: "live" | "preview";
  playerId: string;
  userTier: "guest" | "authed" | "paid";
  gameId: string;
  session: GameSession;
  replaySignature?: string;
};

export type ListLeaderboardOptions = {
  namespace?: "production" | "sandbox";
  includeSandbox?: boolean;
  includePractice?: boolean;
  seasonMode?: "live" | "preview";
};

export type LeaderboardPage = {
  entries: LeaderboardEntry[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
  currentPlayer: { entry: LeaderboardEntry; rank: number } | null;
};

export type LeaderboardIndexSpec = { key: Record<string, 1 | -1>; name: string; unique?: boolean };

export const LEADERBOARD_INDEX_SPECS: LeaderboardIndexSpec[] = [
  { name: "uniq_leaderboard_id", key: { id: 1 }, unique: true },
  { name: "leaderboard_filter_sort", key: { namespace: 1, isPractice: 1, seasonMode: 1, score: -1, maxTile: -1, moves: 1, submittedAtISO: 1, id: 1 } },
  { name: "leaderboard_player", key: { playerId: 1, submittedAtISO: -1, id: 1 } }
];

type LeaderboardStore = {
  upsert: (entry: LeaderboardEntry) => Promise<LeaderboardEntry>;
  list: (limit: number, options: ListLeaderboardOptions) => Promise<LeaderboardEntry[]>;
  page: (offset: number, limit: number, options: ListLeaderboardOptions, playerId?: string) => Promise<{ entries: LeaderboardEntry[]; total: number; currentPlayer: { entry: LeaderboardEntry; rank: number } | null }>;
  listByPlayer: (playerId: string, limit: number) => Promise<LeaderboardEntry[]>;
  removeByPlayer: (playerId: string) => Promise<number>;
  reset: () => Promise<void>;
};

function entrySort(a: LeaderboardEntry, b: LeaderboardEntry) {
  if (a.score !== b.score) return b.score - a.score;
  if (a.maxTile !== b.maxTile) return b.maxTile - a.maxTile;
  if (a.moves !== b.moves) return a.moves - b.moves;
  const submitted = a.submittedAtISO.localeCompare(b.submittedAtISO);
  return submitted || a.id.localeCompare(b.id);
}

function matchesOptions(entry: LeaderboardEntry, options: ListLeaderboardOptions) {
  if (options.namespace && entry.namespace !== options.namespace) return false;
  if (!options.namespace && entry.isSandbox !== (options.includeSandbox ?? false)) return false;
  if (!(options.includePractice ?? false) && entry.isPractice) return false;
  if (options.seasonMode && entry.seasonMode !== options.seasonMode) return false;
  return true;
}

function mongoFilter(options: ListLeaderboardOptions): Filter<LeaderboardEntry> {
  const filter: Filter<LeaderboardEntry> = {};
  if (options.namespace) filter.namespace = options.namespace;
  else filter.isSandbox = options.includeSandbox ?? false;
  if (!(options.includePractice ?? false)) filter.isPractice = false;
  if (options.seasonMode) filter.seasonMode = options.seasonMode;
  return filter;
}

class MemoryLeaderboardStore implements LeaderboardStore {
  private readonly entries = new Map<string, LeaderboardEntry>();
  async upsert(entry: LeaderboardEntry) {
    const existing = this.entries.get(entry.id);
    const persisted = { ...entry, submittedAtISO: existing?.submittedAtISO ?? entry.submittedAtISO };
    this.entries.set(entry.id, persisted);
    return persisted;
  }
  async list(limit: number, options: ListLeaderboardOptions) {
    const entries = Array.from(this.entries.values()).filter((entry) => matchesOptions(entry, options)).sort(entrySort);
    return limit === 0 ? entries : entries.slice(0, limit);
  }
  async page(offset: number, limit: number, options: ListLeaderboardOptions, playerId?: string) {
    const entries = Array.from(this.entries.values()).filter((entry) => matchesOptions(entry, options)).sort(entrySort);
    const currentEntry = playerId ? entries.find((entry) => entry.playerId === playerId) : undefined;
    return {
      entries: entries.slice(offset, offset + limit),
      total: entries.length,
      currentPlayer: currentEntry ? { entry: currentEntry, rank: entries.indexOf(currentEntry) + 1 } : null
    };
  }
  async listByPlayer(playerId: string, limit: number) {
    return Array.from(this.entries.values()).filter((entry) => entry.playerId === playerId).sort(entrySort).slice(0, limit);
  }
  async removeByPlayer(playerId: string) {
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (entry.playerId !== playerId) continue;
      this.entries.delete(id);
      removed += 1;
    }
    return removed;
  }
  async reset() { this.entries.clear(); }
}

class MongoLeaderboardStore implements LeaderboardStore {
  private collectionPromise: Promise<Collection<LeaderboardEntry>> | null = null;
  constructor(
    private readonly uri: string,
    private readonly dbName: string,
    private readonly collectionName: string,
    private readonly timeoutMs: number
  ) {}
  private async collection() {
    if (!this.collectionPromise) {
      const pending = (async () => {
        const client = new MongoClient(this.uri, { serverSelectionTimeoutMS: this.timeoutMs });
        await client.connect();
        const collection = client.db(this.dbName).collection<LeaderboardEntry>(this.collectionName);
        await collection.createIndexes(LEADERBOARD_INDEX_SPECS);
        return collection;
      })();
      const guarded = pending.catch((error: unknown) => {
        if (this.collectionPromise === guarded) this.collectionPromise = null;
        const failure = error as { name?: unknown; code?: unknown };
        console.error("Mongo leaderboard store initialization failed", {
          event: "leaderboard_mongo_initialization_failed",
          errorName: typeof failure?.name === "string" ? failure.name : "UnknownError",
          errorCode: typeof failure?.code === "string" || typeof failure?.code === "number" ? failure.code : "unknown"
        });
        throw error;
      });
      this.collectionPromise = guarded;
    }
    return this.collectionPromise;
  }
  async upsert(entry: LeaderboardEntry) {
    const collection = await this.collection();
    const { submittedAtISO, ...mutable } = entry;
    await collection.updateOne({ id: entry.id }, { $set: mutable, $setOnInsert: { submittedAtISO } }, { upsert: true });
    const persisted = await collection.findOne({ id: entry.id });
    if (!persisted) throw new Error(`Leaderboard entry ${entry.id} was not persisted`);
    return persisted;
  }
  async list(limit: number, options: ListLeaderboardOptions) {
    const cursor = (await this.collection()).find(mongoFilter(options)).sort({ score: -1, maxTile: -1, moves: 1, submittedAtISO: 1, id: 1 });
    return (limit === 0 ? cursor : cursor.limit(limit)).toArray();
  }
  async page(offset: number, limit: number, options: ListLeaderboardOptions, playerId?: string) {
    const collection = await this.collection();
    const filter = mongoFilter(options);
    const [entries, total, currentEntry] = await Promise.all([
      collection.find(filter).sort({ score: -1, maxTile: -1, moves: 1, submittedAtISO: 1, id: 1 }).skip(offset).limit(limit).toArray(),
      collection.countDocuments(filter),
      playerId
        ? collection.find({ ...filter, playerId }).sort({ score: -1, maxTile: -1, moves: 1, submittedAtISO: 1, id: 1 }).limit(1).next()
        : Promise.resolve(null)
    ]);
    if (!currentEntry) return { entries, total, currentPlayer: null };
    const ahead: Filter<LeaderboardEntry> = {
      $or: [
        { score: { $gt: currentEntry.score } },
        { score: currentEntry.score, maxTile: { $gt: currentEntry.maxTile } },
        { score: currentEntry.score, maxTile: currentEntry.maxTile, moves: { $lt: currentEntry.moves } },
        { score: currentEntry.score, maxTile: currentEntry.maxTile, moves: currentEntry.moves, submittedAtISO: { $lt: currentEntry.submittedAtISO } },
        { score: currentEntry.score, maxTile: currentEntry.maxTile, moves: currentEntry.moves, submittedAtISO: currentEntry.submittedAtISO, id: { $lt: currentEntry.id } }
      ]
    };
    const aheadCount = await collection.countDocuments({ $and: [filter, ahead] });
    return { entries, total, currentPlayer: { entry: currentEntry, rank: aheadCount + 1 } };
  }
  async listByPlayer(playerId: string, limit: number) {
    return (await this.collection()).find({ playerId }).sort({ score: -1, maxTile: -1, moves: 1, submittedAtISO: 1, id: 1 }).limit(limit).toArray();
  }
  async removeByPlayer(playerId: string) { return (await (await this.collection()).deleteMany({ playerId })).deletedCount; }
  async reset() { await (await this.collection()).deleteMany({}); }
}

const globalStore = globalThis as typeof globalThis & { __binary2048_leaderboard_store?: LeaderboardStore };

function createLeaderboardStore(): LeaderboardStore {
  const mode = (process.env.BINARY2048_LEADERBOARD_STORE ?? "memory").toLowerCase();
  if (mode === "memory") return new MemoryLeaderboardStore();
  if (mode === "mongo") {
    const uri = process.env.BINARY2048_MONGO_URI;
    if (!uri) throw new Error("BINARY2048_MONGO_URI is required when BINARY2048_LEADERBOARD_STORE=mongo");
    const configuredTimeout = Number(process.env.BINARY2048_MONGO_LEADERBOARD_TIMEOUT_MS ?? "5000");
    const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? Math.floor(configuredTimeout) : 5000;
    return new MongoLeaderboardStore(
      uri,
      process.env.BINARY2048_MONGO_DB ?? "binary2048",
      process.env.BINARY2048_MONGO_LEADERBOARD_COLLECTION ?? "leaderboard_entries",
      timeoutMs
    );
  }
  throw new Error(`Unsupported BINARY2048_LEADERBOARD_STORE: ${mode}`);
}

function getLeaderboardStore() {
  if (!globalStore.__binary2048_leaderboard_store) globalStore.__binary2048_leaderboard_store = createLeaderboardStore();
  return globalStore.__binary2048_leaderboard_store;
}

type LeaderboardEligibility = { eligible: boolean; bracket: "ranked_pure" | "ranked_boosted"; reason?: string };

function countNonEmptyCells(session: GameSession): number { return session.initialState.grid.flat().filter(Boolean).length; }

export function getLeaderboardEligibility(session: GameSession): LeaderboardEligibility {
  if (session.integrity.sessionClass !== "ranked" || session.integrity.source !== "created") return { eligible: false, bracket: "ranked_boosted", reason: "Only ranked created sessions are eligible" };
  if (countNonEmptyCells(session) !== 2) return { eligible: false, bracket: "ranked_boosted", reason: "Seeded starts are not eligible for ranked leaderboard" };
  if (session.undoUsed > 0) return { eligible: false, bracket: "ranked_boosted", reason: "Undo-assisted runs are not eligible for ranked_pure" };
  return { eligible: true, bracket: "ranked_pure" };
}

function getMaxTile(session: GameSession): number { return Math.max(0, ...session.current.grid.flat().map((cell) => cell?.t === "n" ? cell.v : 0)); }
function getMovedStepCount(session: GameSession): number { return session.steps.filter((step) => step.moved).length; }
function safeLimit(limit: number, fallback: number) { return Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : fallback; }

export async function submitLeaderboardEntry(params: SubmitLeaderboardParams) {
  const { session, playerId, userTier, gameId, replaySignature } = params;
  const namespace = params.namespace ?? (params.isSandbox ? "sandbox" : "production");
  const isSandbox = namespace === "sandbox";
  const seasonMode = params.seasonMode ?? (isSandbox ? "preview" : "live");
  const entry = await getLeaderboardStore().upsert({
    id: `lb_${namespace}_${gameId}`, namespace, isSandbox, isPractice: Boolean(params.isPractice), seasonMode,
    playerId, userTier, gameId, score: session.current.score, moves: getMovedStepCount(session), maxTile: getMaxTile(session),
    stateHash: stateHash(session.current), rulesetId: "binary2048-v1", replaySignature, submittedAtISO: new Date().toISOString()
  });
  const entries = await getLeaderboardStore().list(0, { namespace, includePractice: true, includeSandbox: isSandbox, seasonMode });
  return { entry, rank: entries.findIndex((item) => item.id === entry.id) + 1, total: entries.length };
}

export async function listLeaderboardEntries(limit = 20, options: ListLeaderboardOptions = {}) { return getLeaderboardStore().list(safeLimit(limit, 20), options); }
export async function getLeaderboardPage(limit = 20, page = 1, options: ListLeaderboardOptions = {}, playerId?: string): Promise<LeaderboardPage> {
  const safePageSize = Math.min(100, safeLimit(limit, 20));
  const requestedPage = safeLimit(page, 1);
  let result = await getLeaderboardStore().page((requestedPage - 1) * safePageSize, safePageSize, options, playerId);
  const totalPages = Math.max(1, Math.ceil(result.total / safePageSize));
  const resolvedPage = Math.min(requestedPage, totalPages);
  if (resolvedPage !== requestedPage) {
    result = await getLeaderboardStore().page((resolvedPage - 1) * safePageSize, safePageSize, options, playerId);
  }
  return { ...result, limit: safePageSize, page: resolvedPage, totalPages };
}
export async function listLeaderboardEntriesByPlayer(playerId: string, limit = 100) { return getLeaderboardStore().listByPlayer(playerId, safeLimit(limit, 100)); }
export async function removeLeaderboardEntriesByPlayer(playerId: string) { return getLeaderboardStore().removeByPlayer(playerId); }
export async function resetLeaderboard() {
  if (globalStore.__binary2048_leaderboard_store) await globalStore.__binary2048_leaderboard_store.reset();
  delete globalStore.__binary2048_leaderboard_store;
}
