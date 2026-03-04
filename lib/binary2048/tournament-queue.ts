export class TournamentQueueFullError extends Error {
  constructor(message = "Tournament queue is full") {
    super(message);
    this.name = "TournamentQueueFullError";
  }
}

export class TournamentQueueTimeoutError extends Error {
  constructor(message = "Tournament queue wait timeout") {
    super(message);
    this.name = "TournamentQueueTimeoutError";
  }
}

export type TournamentQueueOptions = {
  maxConcurrent: number;
  maxQueue: number;
  waitTimeoutMs: number;
};

type PendingEntry = {
  id: number;
  done: boolean;
  maxConcurrent: number;
  timer: ReturnType<typeof setTimeout>;
  resolve: (slot: TournamentQueueSlot) => void;
  reject: (error: Error) => void;
};

export type TournamentQueueSlot = {
  release: () => void;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_tournament_active?: number;
  __binary2048_tournament_pending?: PendingEntry[];
  __binary2048_tournament_pending_id?: number;
};

let active = globalStore.__binary2048_tournament_active ?? 0;
const pending = globalStore.__binary2048_tournament_pending ?? [];
let pendingId = globalStore.__binary2048_tournament_pending_id ?? 1;
globalStore.__binary2048_tournament_active = active;
globalStore.__binary2048_tournament_pending = pending;
globalStore.__binary2048_tournament_pending_id = pendingId;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return fallback;
  return value;
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) return fallback;
  return value;
}

function sanitizeOptions(options: TournamentQueueOptions): TournamentQueueOptions {
  return {
    maxConcurrent: Math.max(1, options.maxConcurrent),
    maxQueue: Math.max(0, options.maxQueue),
    waitTimeoutMs: Math.max(1, options.waitTimeoutMs)
  };
}

function createSlot(maxConcurrent: number): TournamentQueueSlot {
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
      globalStore.__binary2048_tournament_active = active;
      processPending(maxConcurrent);
    }
  };
}

function processPending(maxConcurrent: number) {
  while (pending.length > 0) {
    const entry = pending.shift();
    if (!entry || entry.done) continue;
    if (active >= Math.max(1, Math.min(maxConcurrent, entry.maxConcurrent))) {
      pending.unshift(entry);
      return;
    }
    entry.done = true;
    clearTimeout(entry.timer);
    active += 1;
    globalStore.__binary2048_tournament_active = active;
    entry.resolve(createSlot(entry.maxConcurrent));
    return;
  }
}

export function getTournamentQueueStats() {
  return { active, queued: pending.filter((item) => !item.done).length };
}

export function resolveTournamentQueueOptions(): TournamentQueueOptions {
  return sanitizeOptions({
    maxConcurrent: parsePositiveInt(process.env.BINARY2048_TOURNAMENT_MAX_CONCURRENT, 2),
    maxQueue: parseNonNegativeInt(process.env.BINARY2048_TOURNAMENT_MAX_QUEUE, 8),
    waitTimeoutMs: parsePositiveInt(process.env.BINARY2048_TOURNAMENT_QUEUE_WAIT_TIMEOUT_MS, 15000)
  });
}

export async function acquireTournamentSlot(rawOptions: TournamentQueueOptions): Promise<TournamentQueueSlot> {
  const options = sanitizeOptions(rawOptions);
  if (active < options.maxConcurrent) {
    active += 1;
    globalStore.__binary2048_tournament_active = active;
    return createSlot(options.maxConcurrent);
  }

  const liveQueued = pending.filter((item) => !item.done).length;
  if (liveQueued >= options.maxQueue) {
    throw new TournamentQueueFullError();
  }

  const id = pendingId++;
  globalStore.__binary2048_tournament_pending_id = pendingId;
  return new Promise<TournamentQueueSlot>((resolve, reject) => {
    const timer = setTimeout(() => {
      const entry = pending.find((item) => item.id === id);
      if (!entry || entry.done) return;
      entry.done = true;
      reject(new TournamentQueueTimeoutError());
    }, options.waitTimeoutMs);
    pending.push({
      id,
      done: false,
      maxConcurrent: options.maxConcurrent,
      timer,
      resolve,
      reject
    });
  });
}

export function resetTournamentQueue() {
  for (const entry of pending) {
    clearTimeout(entry.timer);
  }
  pending.length = 0;
  active = 0;
  pendingId = 1;
  globalStore.__binary2048_tournament_active = active;
  globalStore.__binary2048_tournament_pending = pending;
  globalStore.__binary2048_tournament_pending_id = pendingId;
}
