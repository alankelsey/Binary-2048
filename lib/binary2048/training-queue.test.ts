import {
  acquireTrainingSlot,
  getTrainingQueueStats,
  resetTrainingQueue,
  TrainingQueueFullError,
  TrainingQueueTimeoutError
} from "@/lib/binary2048/training-queue";

describe("training-queue", () => {
  beforeEach(() => resetTrainingQueue());

  it("queues training independently with bounded concurrency", async () => {
    const first = await acquireTrainingSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1000 });
    const secondPromise = acquireTrainingSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1000 });
    expect(getTrainingQueueStats()).toEqual({ active: 1, queued: 1 });
    first.release();
    const second = await secondPromise;
    expect(getTrainingQueueStats()).toEqual({ active: 1, queued: 0 });
    second.release();
  });

  it("rejects work when the training queue is full", async () => {
    const first = await acquireTrainingSlot({ maxConcurrent: 1, maxQueue: 0, waitTimeoutMs: 1000 });
    await expect(acquireTrainingSlot({ maxConcurrent: 1, maxQueue: 0, waitTimeoutMs: 1000 }))
      .rejects.toBeInstanceOf(TrainingQueueFullError);
    first.release();
  });

  it("times out queued training work", async () => {
    const first = await acquireTrainingSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 1000 });
    await expect(acquireTrainingSlot({ maxConcurrent: 1, maxQueue: 1, waitTimeoutMs: 5 }))
      .rejects.toBeInstanceOf(TrainingQueueTimeoutError);
    first.release();
  });
});
