import {
  acquireTournamentSlot,
  getTournamentQueueStats,
  resetTournamentQueue,
  TournamentQueueFullError,
  TournamentQueueTimeoutError
} from "@/lib/binary2048/tournament-queue";

describe("tournament-queue", () => {
  beforeEach(() => {
    resetTournamentQueue();
  });

  it("acquires and releases immediate slot", async () => {
    const slot = await acquireTournamentSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1000 });
    expect(getTournamentQueueStats().active).toBe(1);
    slot.release();
    expect(getTournamentQueueStats().active).toBe(0);
  });

  it("queues second slot until first is released", async () => {
    const first = await acquireTournamentSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1000 });
    const secondPromise = acquireTournamentSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1000 });
    expect(getTournamentQueueStats().queued).toBe(1);

    first.release();
    const second = await secondPromise;
    expect(getTournamentQueueStats().active).toBe(1);
    second.release();
    expect(getTournamentQueueStats().active).toBe(0);
  });

  it("throws queue_full when pending limit is exceeded", async () => {
    const first = await acquireTournamentSlot({ maxConcurrent: 1, maxQueue: 0, waitTimeoutMs: 1000 });
    await expect(
      acquireTournamentSlot({ maxConcurrent: 1, maxQueue: 0, waitTimeoutMs: 1000 })
    ).rejects.toBeInstanceOf(TournamentQueueFullError);
    first.release();
  });

  it("throws queue_timeout when wait timeout is reached", async () => {
    const first = await acquireTournamentSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1000 });
    await expect(
      acquireTournamentSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 5 })
    ).rejects.toBeInstanceOf(TournamentQueueTimeoutError);
    first.release();
  });
});

