import {
  MOVE_PERFORMANCE_COMPLETE_MARK,
  MOVE_PERFORMANCE_DROPPED_MARK,
  MOVE_PERFORMANCE_MEASURE,
  discardMovePerformanceTrace,
  dropMovePerformanceTrace,
  finishMovePerformanceTrace,
  markMovePerformancePhase,
  recordMoveQueueDepth,
  startMovePerformanceTrace,
  type MovePerformanceTarget
} from "@/lib/binary2048/move-performance";

function fakePerformance() {
  let now = 10;
  const marks: Array<{ name: string; options?: { detail?: unknown } }> = [];
  const measures: Array<{ name: string; options: { start: number; end: number; detail?: unknown } }> = [];
  const target: MovePerformanceTarget = {
    now: () => now++,
    mark: (name, options) => marks.push({ name, options }),
    measure: (name, options) => measures.push({ name, options }),
    clearMarks: (name) => {
      for (let index = marks.length - 1; index >= 0; index -= 1) {
        if (!name || marks[index].name === name) marks.splice(index, 1);
      }
    },
    clearMeasures: (name) => {
      for (let index = measures.length - 1; index >= 0; index -= 1) {
        if (!name || measures[index].name === name) measures.splice(index, 1);
      }
    },
    getEntriesByName: (name) => [
      ...marks.filter((entry) => entry.name === name),
      ...measures.filter((entry) => entry.name === name)
    ]
  };
  return { target, marks, measures };
}

describe("move performance tracing", () => {
  it("records the input-to-frame phase order and removes per-trace marks", () => {
    const { target, marks, measures } = fakePerformance();
    const trace = startMovePerformanceTrace("left", "keyboard", target);
    recordMoveQueueDepth(trace, "capture", 0, target);
    markMovePerformancePhase(trace, "accepted", undefined, target);
    markMovePerformancePhase(trace, "local_engine_not_run", undefined, target);
    markMovePerformancePhase(trace, "request_start", 1, target);
    markMovePerformancePhase(trace, "response_headers", 1, target);
    markMovePerformancePhase(trace, "response_parse_start", 1, target);
    markMovePerformancePhase(trace, "response_parse_end", 1, target);
    markMovePerformancePhase(trace, "react_commit", undefined, target);
    finishMovePerformanceTrace(trace, target);

    expect(trace.phases.map((entry) => entry.phase)).toEqual([
      "input_capture",
      "accepted",
      "local_engine_not_run",
      "request_start",
      "response_headers",
      "response_parse_start",
      "response_parse_end",
      "react_commit",
      "next_animation_frame"
    ]);
    expect(marks.filter((entry) => entry.name === MOVE_PERFORMANCE_COMPLETE_MARK)).toHaveLength(1);
    expect(marks.filter((entry) => entry.name.includes(trace.id))).toHaveLength(0);
    expect(measures).toEqual([
      expect.objectContaining({
        name: MOVE_PERFORMANCE_MEASURE,
        options: expect.objectContaining({ start: 11, end: 20 })
      })
    ]);
    expect(measures[0].options.detail).toMatchObject({
      traceId: trace.id,
      localEngineStatus: "not_run",
      outcome: "completed",
      queueDepthSamples: [{ stage: "capture", depth: 0, atMs: 12 }]
    });
  });

  it("records queue depth through enqueue and dequeue", () => {
    const { target, marks } = fakePerformance();
    const trace = startMovePerformanceTrace("left", "keyboard", target);
    recordMoveQueueDepth(trace, "capture", 2, target);
    recordMoveQueueDepth(trace, "enqueue", 3, target);
    recordMoveQueueDepth(trace, "dequeue", 1, target);
    markMovePerformancePhase(trace, "queued", undefined, target);
    finishMovePerformanceTrace(trace, target);

    const completed = marks.find((entry) => entry.name === MOVE_PERFORMANCE_COMPLETE_MARK);
    expect(completed?.options?.detail).toMatchObject({
      outcome: "completed",
      queueDepthSamples: [
        { stage: "capture", depth: 2 },
        { stage: "enqueue", depth: 3 },
        { stage: "dequeue", depth: 1 }
      ]
    });
    expect(marks.some((entry) => entry.name.includes(trace.id))).toBe(false);
  });

  it("retains a classified drop while removing per-trace marks", () => {
    const { target, marks, measures } = fakePerformance();
    const trace = startMovePerformanceTrace("right", "touch", target);
    recordMoveQueueDepth(trace, "capture", 8, target);
    dropMovePerformanceTrace(trace, "queue_full", 8, target);

    const dropped = marks.find((entry) => entry.name === MOVE_PERFORMANCE_DROPPED_MARK);
    expect(dropped?.options?.detail).toMatchObject({
      traceId: trace.id,
      direction: "right",
      source: "touch",
      outcome: "dropped",
      dropReason: "queue_full",
      queueDepthSamples: [
        { stage: "capture", depth: 8 },
        { stage: "drop", depth: 8 }
      ],
      phases: [{ phase: "input_capture" }, { phase: "dropped" }]
    });
    expect(marks.filter((entry) => entry.name.includes(trace.id))).toHaveLength(0);
    expect(measures).toHaveLength(0);
  });

  it("distinguishes retry attempts and can discard an unfinished trace", () => {
    const { target, marks } = fakePerformance();
    const trace = startMovePerformanceTrace("down", "touch", target);
    markMovePerformancePhase(trace, "queued", undefined, target);
    markMovePerformancePhase(trace, "request_start", 1, target);
    markMovePerformancePhase(trace, "response_headers", 1, target);
    markMovePerformancePhase(trace, "request_start", 2, target);
    expect(marks.some((entry) => entry.name.endsWith("request_start:1"))).toBe(true);
    expect(marks.some((entry) => entry.name.endsWith("request_start:2"))).toBe(true);

    discardMovePerformanceTrace(trace, target);
    expect(marks).toHaveLength(0);
  });

  it("is safe when the Performance API is unavailable", () => {
    const trace = startMovePerformanceTrace("right", "control", null);
    expect(() => {
      markMovePerformancePhase(trace, "accepted", undefined, null);
      recordMoveQueueDepth(trace, "capture", 0, null);
      finishMovePerformanceTrace(trace, null);
      dropMovePerformanceTrace(trace, "busy", 0, null);
      discardMovePerformanceTrace(trace, null);
    }).not.toThrow();
  });

  it("bounds retained completed marks and measures", () => {
    const { target } = fakePerformance();
    for (let index = 0; index < 101; index += 1) {
      const trace = startMovePerformanceTrace("up", "keyboard", target);
      markMovePerformancePhase(trace, "react_commit", undefined, target);
      finishMovePerformanceTrace(trace, target);
    }

    expect(target.getEntriesByName(MOVE_PERFORMANCE_COMPLETE_MARK).length).toBeLessThanOrEqual(100);
    expect(target.getEntriesByName(MOVE_PERFORMANCE_MEASURE).length).toBeLessThanOrEqual(100);
  });

  it("bounds retained dropped-input marks independently", () => {
    const { target } = fakePerformance();
    for (let index = 0; index < 101; index += 1) {
      const trace = startMovePerformanceTrace("right", "touch", target);
      dropMovePerformanceTrace(trace, "busy", index, target);
    }

    expect(target.getEntriesByName(MOVE_PERFORMANCE_DROPPED_MARK).length).toBeLessThanOrEqual(100);
  });
});
