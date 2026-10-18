import { createResumeWriteQueue } from "@/lib/binary2048/resume-write-queue";

describe("resume write queue", () => {
  it("coalesces to the latest revision and rejects stale flushes", () => {
    const queue = createResumeWriteQueue<string>();
    const first = queue.enqueue("checkpoint");
    const latest = queue.enqueue("checkpoint-plus-tail");
    const writes: string[] = [];

    expect(queue.flush(first.revision, (value) => writes.push(value))).toBeNull();
    expect(queue.flush(latest.revision, (value) => writes.push(value))).toEqual(latest);
    expect(queue.flush(latest.revision, (value) => writes.push(value))).toBeNull();
    expect(writes).toEqual(["checkpoint-plus-tail"]);
  });

  it("invalidates scheduled work when a game clears its resume record", () => {
    const queue = createResumeWriteQueue<string>();
    const pending = queue.enqueue("old-game");
    queue.clear();
    expect(queue.flush(pending.revision, () => { throw new Error("must not write"); })).toBeNull();
  });
});
