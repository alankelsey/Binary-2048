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

export type LeaderboardIndexSpec = { key: Record<string, 1 | -1>; name: string; unique?: boolean };

export const LEADERBOARD_INDEX_SPECS: LeaderboardIndexSpec[] = [
  { name: "uniq_leaderboard_id", key: { id: 1 }, unique: true },
  { name: "leaderboard_filter_sort", key: { namespace: 1, isPractice: 1, seasonMode: 1, score: -1, maxTile: -1, moves: 1, submittedAtISO: 1, id: 1 } },
  { name: "leaderboard_player", key: { playerId: 1, submittedAtISO: -1, id: 1 } }
];

type LeaderboardStore = {
  upsert: (entry: LeaderboardEntry) => Promise<LeaderboardEntry>;
  list: (limit: number, options: ListLeaderboardOptions) => Promise<LeaderboardEntry[]>;
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
      this.collectionPromise = (async () => {
        const client = new MongoClient(this.uri, { serverSelectionTimeoutMS: this.timeoutMs });
        await client.connect();
        const collection = client.db(this.dbName).collection<LeaderboardEntry>(this.collectionName);
        await collection.createIndexes(LEADERBOARD_INDEX_SPECS);
        return collection;
      })();
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
export async function listLeaderboardEntriesByPlayer(playerId: string, limit = 100) { return getLeaderboardStore().listByPlayer(playerId, safeLimit(limit, 100)); }
export async function removeLeaderboardEntriesByPlayer(playerId: string) { return getLeaderboardStore().removeByPlayer(playerId); }
export async function resetLeaderboard() {
  if (globalStore.__binary2048_leaderboard_store) await globalStore.__binary2048_leaderboard_store.reset();
  delete globalStore.__binary2048_leaderboard_store;
}
