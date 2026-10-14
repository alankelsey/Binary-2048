import {
  beginMoveRuntimeObservation,
  resetMoveRuntimeTelemetryForTests,
  sanitizeMoveRuntimeTelemetry,
  shouldSampleMoveRuntime
} from "@/lib/binary2048/move-runtime-telemetry";

describe("move runtime telemetry", () => {
  beforeEach(() => resetMoveRuntimeTelemetryForTests());
  afterEach(() => resetMoveRuntimeTelemetryForTests());

  it("distinguishes first observation, reuse, and instrumented concurrency", () => {
    const first = beginMoveRuntimeObservation();
    const second = beginMoveRuntimeObservation();
    const secondResult = second.finish();
    const firstResult = first.finish();

    expect(firstResult.observation).toBe("first_observed");
    expect(firstResult.requestOrdinal).toBe(1);
    expect(secondResult.observation).toBe("reused");
    expect(secondResult.requestOrdinal).toBe(2);
    expect(secondResult.runtimeId).toBe(firstResult.runtimeId);
    expect(secondResult.workload.movesInFlightAtStart).toBe(2);
    expect(secondResult.workload.movesInFlightAtEnd).toBe(1);
    expect(firstResult.workload.movesInFlightAtEnd).toBe(0);
    expect(firstResult.workload.processPeakMovesInFlight).toBe(2);
    expect(firstResult.memory.rssMiB).toBeGreaterThan(0);
    expect(firstResult.eventLoop.utilizationPct).toBeGreaterThanOrEqual(0);
  });

  it("samples first, early, periodic, error, missing, and recovery observations", () => {
    const runtime = beginMoveRuntimeObservation().finish();
    expect(shouldSampleMoveRuntime(runtime, 200, "resident_memory")).toBe(true);
    expect(shouldSampleMoveRuntime({ ...runtime, requestOrdinal: 6 }, 200, "resident_memory")).toBe(false);
    expect(shouldSampleMoveRuntime({ ...runtime, requestOrdinal: 20 }, 200, "resident_memory")).toBe(true);
    expect(shouldSampleMoveRuntime({ ...runtime, requestOrdinal: 6 }, 503, "not_checked")).toBe(true);
    expect(shouldSampleMoveRuntime({
      ...runtime,
      requestOrdinal: 6,
      workload: { ...runtime.workload, movesInFlightAtStart: 2 }
    }, 200, "resident_memory")).toBe(true);
    expect(shouldSampleMoveRuntime({ ...runtime, requestOrdinal: 6 }, 404, "missing")).toBe(true);
    expect(shouldSampleMoveRuntime({ ...runtime, requestOrdinal: 6 }, 200, "recovery_snapshot")).toBe(true);
  });

  it("serializes only the fixed schema and clamps invalid numeric values", () => {
    const runtime = beginMoveRuntimeObservation().finish();
    const injected = {
      ...runtime,
      secret: "must-not-survive",
      runtimeId: "host-derived-id",
      runtimeAgeMs: Number.POSITIVE_INFINITY,
      memory: { ...runtime.memory, rssMiB: -1, hostname: "private-host" }
    } as typeof runtime;
    const sanitized = sanitizeMoveRuntimeTelemetry(injected);
    const serialized = JSON.stringify(sanitized);

    expect(sanitized.runtimeId).toBe("unavailable");
    expect(sanitized.runtimeAgeMs).toBe(0);
    expect(sanitized.memory.rssMiB).toBe(0);
    expect(serialized).not.toContain("must-not-survive");
    expect(serialized).not.toContain("private-host");
    expect(Object.keys(sanitized)).toEqual([
      "schemaVersion",
      "runtimeId",
      "observation",
      "requestOrdinal",
      "runtimeAgeMs",
      "eventLoop",
      "memory",
      "gc",
      "workload"
    ]);
  });
});
