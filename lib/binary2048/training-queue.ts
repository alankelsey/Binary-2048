export class TrainingQueueFullError extends Error {
  constructor(message = "Training queue is full") {
    super(message);
    this.name = "TrainingQueueFullError";
  }
}
export class TrainingQueueTimeoutError extends Error {
  constructor(message = "Training queue wait timeout") {
    super(message);
    this.name = "TrainingQueueTimeoutError";
  }
}

export type TrainingQueueOptions = {
  maxConcurrent: number;
  maxQueue: number;
  waitTimeoutMs: number;
};

type PendingEntry = {
  id: number;
  done: boolean;
  maxConcurrent: number;
  timer: ReturnType<typeof setTimeout>;
  resolve: (slot: TrainingQueueSlot) => void;
  reject: (error: Error) => void;
};

export type TrainingQueueSlot = {
  release: () => void;
};

const globalStore = globalThis as typeof globalThis & {
  __binary2048_training_active?: number;
  __binary2048_training_pending?: PendingEntry[];
  __binary2048_training_pending_id?: number;
};

let active = globalStore.__binary2048_training_active ?? 0;
const pending = globalStore.__binary2048_training_pending ?? [];
let pendingId = globalStore.__binary2048_training_pending_id ?? 1;
globalStore.__binary2048_training_active = active;
globalStore.__binary2048_training_pending = pending;
globalStore.__binary2048_training_pending_id = pendingId;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function sanitizeOptions(options: TrainingQueueOptions): TrainingQueueOptions {
  return {
    maxConcurrent: Math.max(1, options.maxConcurrent),
    maxQueue: Math.max(0, options.maxQueue),
    waitTimeoutMs: Math.max(1, options.waitTimeoutMs)
  };
}

function createSlot(maxConcurrent: number): TrainingQueueSlot {
  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
      globalStore.__binary2048_training_active = active;
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
    globalStore.__binary2048_training_active = active;
    entry.resolve(createSlot(entry.maxConcurrent));
    return;
  }
}

export function getTrainingQueueStats() {
  return { active, queued: pending.filter((item) => !item.done).length };
}

export function resolveTrainingQueueOptions(): TrainingQueueOptions {
  return sanitizeOptions({
    maxConcurrent: parsePositiveInt(process.env.BINARY2048_TRAINING_MAX_CONCURRENT, 1),
    maxQueue: parseNonNegativeInt(process.env.BINARY2048_TRAINING_MAX_QUEUE, 2),
    waitTimeoutMs: parsePositiveInt(process.env.BINARY2048_TRAINING_QUEUE_WAIT_TIMEOUT_MS, 10000)
  });
}

export async function acquireTrainingSlot(rawOptions: TrainingQueueOptions): Promise<TrainingQueueSlot> {
  const options = sanitizeOptions(rawOptions);
  if (active < options.maxConcurrent) {
    active += 1;
    globalStore.__binary2048_training_active = active;
    return createSlot(options.maxConcurrent);
  }

  const liveQueued = pending.filter((item) => !item.done).length;
  if (liveQueued >= options.maxQueue) throw new TrainingQueueFullError();

  const id = pendingId++;
  globalStore.__binary2048_training_pending_id = pendingId;
  return new Promise<TrainingQueueSlot>((resolve, reject) => {
    const timer = setTimeout(() => {
      const entry = pending.find((item) => item.id === id);
      if (!entry || entry.done) return;
      entry.done = true;
      reject(new TrainingQueueTimeoutError());
    }, options.waitTimeoutMs);
    pending.push({ id, done: false, maxConcurrent: options.maxConcurrent, timer, resolve, reject });
  });
}

export function resetTrainingQueue() {
  for (const entry of pending) clearTimeout(entry.timer);
  pending.length = 0;
  active = 0;
  pendingId = 1;
  globalStore.__binary2048_training_active = active;
  globalStore.__binary2048_training_pending = pending;
  globalStore.__binary2048_training_pending_id = pendingId;
}
