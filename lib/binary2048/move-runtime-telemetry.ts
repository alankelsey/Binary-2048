import { randomBytes } from "node:crypto";
import { monitorEventLoopDelay, performance, PerformanceObserver, type IntervalHistogram } from "node:perf_hooks";

export type MoveRuntimeTelemetry = {
  schemaVersion: 1;
  runtimeId: string;
  observation: "first_observed" | "reused";
  requestOrdinal: number;
  runtimeAgeMs: number;
  eventLoop: {
    monitor: "available" | "unavailable";
    windowMs: number;
    meanDelayMs: number;
    p95DelayMs: number;
    maxDelayMs: number;
    utilizationPct: number;
  };
  memory: {
    monitor: "available" | "unavailable";
    rssMiB: number;
    heapUsedMiB: number;
    heapTotalMiB: number;
    externalMiB: number;
    arrayBuffersMiB: number;
  };
  gc: {
    monitor: "available" | "unavailable";
    observedCount: number;
    durationTotalMs: number;
    durationMaxMs: number;
  };
  workload: {
    monitor: "instrumented_move_route_only";
    movesInFlightAtStart: number;
    movesInFlightAtEnd: number;
    processPeakMovesInFlight: number;
  };
};

type RuntimeState = {
  initializedAtMs: number;
  runtimeId: string;
  requestCount: number;
  movesInFlight: number;
  peakMovesInFlight: number;
  eventLoopHistogram: IntervalHistogram | null;
  gcObserver: PerformanceObserver | null;
  gcCount: number;
  gcDurationTotalMs: number;
  gcDurationMaxMs: number;
};

const globalRuntime = globalThis as typeof globalThis & {
  __binary2048_move_runtime_telemetry?: RuntimeState;
};

function finite(value: number, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isFinite(value) ? Math.max(0, Math.min(maximum, value)) : 0;
}

function rounded(value: number, digits = 2, maximum?: number) {
  return Number(finite(value, maximum).toFixed(digits));
}

function createRuntimeState(): RuntimeState {
  let eventLoopHistogram: IntervalHistogram | null = null;
  try {
    eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
    eventLoopHistogram.enable();
  } catch {
    eventLoopHistogram = null;
  }

  const state: RuntimeState = {
    initializedAtMs: Date.now(),
    runtimeId: randomBytes(8).toString("hex"),
    requestCount: 0,
    movesInFlight: 0,
    peakMovesInFlight: 0,
    eventLoopHistogram,
    gcObserver: null,
    gcCount: 0,
    gcDurationTotalMs: 0,
    gcDurationMaxMs: 0
  };

  try {
    state.gcObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const durationMs = finite(entry.duration, 60_000);
        state.gcCount = Math.min(1_000_000, state.gcCount + 1);
        state.gcDurationTotalMs = finite(state.gcDurationTotalMs + durationMs, 3_600_000);
        state.gcDurationMaxMs = Math.max(state.gcDurationMaxMs, durationMs);
      }
    });
    state.gcObserver.observe({ entryTypes: ["gc"] });
  } catch {
    state.gcObserver = null;
  }
  return state;
}

function runtimeState() {
  if (!globalRuntime.__binary2048_move_runtime_telemetry) {
    globalRuntime.__binary2048_move_runtime_telemetry = createRuntimeState();
  }
  return globalRuntime.__binary2048_move_runtime_telemetry;
}

function eventLoopSnapshot(state: RuntimeState, startedUtilization: ReturnType<typeof performance.eventLoopUtilization>) {
  const utilization = performance.eventLoopUtilization(startedUtilization);
  const histogram = state.eventLoopHistogram;
  return {
    monitor: histogram ? "available" as const : "unavailable" as const,
    windowMs: Math.round(finite(Date.now() - state.initializedAtMs, 86_400_000)),
    meanDelayMs: histogram ? rounded(histogram.mean / 1e6, 2, 60_000) : 0,
    p95DelayMs: histogram ? rounded(histogram.percentile(95) / 1e6, 2, 60_000) : 0,
    maxDelayMs: histogram ? rounded(histogram.max / 1e6, 2, 60_000) : 0,
    utilizationPct: rounded(utilization.utilization * 100, 2, 100)
  };
}

function memorySnapshot(): MoveRuntimeTelemetry["memory"] {
  try {
    const memory = process.memoryUsage();
    const toMiB = (bytes: number) => Math.round(finite(bytes) / (1024 * 1024));
    return {
      monitor: "available",
      rssMiB: toMiB(memory.rss),
      heapUsedMiB: toMiB(memory.heapUsed),
      heapTotalMiB: toMiB(memory.heapTotal),
      externalMiB: toMiB(memory.external),
      arrayBuffersMiB: toMiB(memory.arrayBuffers)
    };
  } catch {
    return { monitor: "unavailable", rssMiB: 0, heapUsedMiB: 0, heapTotalMiB: 0, externalMiB: 0, arrayBuffersMiB: 0 };
  }
}

export function beginMoveRuntimeObservation() {
  const state = runtimeState();
  state.requestCount = Math.min(1_000_000, state.requestCount + 1);
  state.movesInFlight = Math.min(10_000, state.movesInFlight + 1);
  state.peakMovesInFlight = Math.max(state.peakMovesInFlight, state.movesInFlight);
  const requestOrdinal = state.requestCount;
  const movesInFlightAtStart = state.movesInFlight;
  const startedUtilization = performance.eventLoopUtilization();
  let finished = false;

  return {
    finish(): MoveRuntimeTelemetry {
      if (!finished) {
        finished = true;
        state.movesInFlight = Math.max(0, state.movesInFlight - 1);
      }
      return {
        schemaVersion: 1,
        runtimeId: state.runtimeId,
        observation: requestOrdinal === 1 ? "first_observed" : "reused",
        requestOrdinal,
        runtimeAgeMs: Math.round(finite(Date.now() - state.initializedAtMs, 86_400_000)),
        eventLoop: eventLoopSnapshot(state, startedUtilization),
        memory: memorySnapshot(),
        gc: {
          monitor: state.gcObserver ? "available" : "unavailable",
          observedCount: state.gcCount,
          durationTotalMs: rounded(state.gcDurationTotalMs, 2, 3_600_000),
          durationMaxMs: rounded(state.gcDurationMaxMs, 2, 60_000)
        },
        workload: {
          monitor: "instrumented_move_route_only",
          movesInFlightAtStart,
          movesInFlightAtEnd: state.movesInFlight,
          processPeakMovesInFlight: state.peakMovesInFlight
        }
      };
    }
  };
}

export function shouldSampleMoveRuntime(
  runtime: MoveRuntimeTelemetry,
  status: number,
  sessionPath: string
) {
  return runtime.requestOrdinal <= 5 || runtime.requestOrdinal % 20 === 0 || status >= 400 ||
    runtime.workload.movesInFlightAtStart > 1 ||
    sessionPath === "recovery_snapshot" || sessionPath === "legacy_export" || sessionPath === "missing";
}

export function sanitizeMoveRuntimeTelemetry(input: MoveRuntimeTelemetry): MoveRuntimeTelemetry {
  const number = (value: number, maximum = Number.MAX_SAFE_INTEGER) => rounded(value, 2, maximum);
  return {
    schemaVersion: 1,
    runtimeId: /^[a-f0-9]{16}$/.test(input.runtimeId) ? input.runtimeId : "unavailable",
    observation: input.observation === "first_observed" ? "first_observed" : "reused",
    requestOrdinal: Math.round(number(input.requestOrdinal, 1_000_000)),
    runtimeAgeMs: Math.round(number(input.runtimeAgeMs, 86_400_000)),
    eventLoop: {
      monitor: input.eventLoop.monitor === "available" ? "available" : "unavailable",
      windowMs: Math.round(number(input.eventLoop.windowMs, 86_400_000)),
      meanDelayMs: number(input.eventLoop.meanDelayMs, 60_000),
      p95DelayMs: number(input.eventLoop.p95DelayMs, 60_000),
      maxDelayMs: number(input.eventLoop.maxDelayMs, 60_000),
      utilizationPct: number(input.eventLoop.utilizationPct, 100)
    },
    memory: {
      monitor: input.memory.monitor === "available" ? "available" : "unavailable",
      rssMiB: Math.round(number(input.memory.rssMiB, 1_000_000)),
      heapUsedMiB: Math.round(number(input.memory.heapUsedMiB, 1_000_000)),
      heapTotalMiB: Math.round(number(input.memory.heapTotalMiB, 1_000_000)),
      externalMiB: Math.round(number(input.memory.externalMiB, 1_000_000)),
      arrayBuffersMiB: Math.round(number(input.memory.arrayBuffersMiB, 1_000_000))
    },
    gc: {
      monitor: input.gc.monitor === "available" ? "available" : "unavailable",
      observedCount: Math.round(number(input.gc.observedCount, 1_000_000)),
      durationTotalMs: number(input.gc.durationTotalMs, 3_600_000),
      durationMaxMs: number(input.gc.durationMaxMs, 60_000)
    },
    workload: {
      monitor: "instrumented_move_route_only",
      movesInFlightAtStart: Math.round(number(input.workload.movesInFlightAtStart, 10_000)),
      movesInFlightAtEnd: Math.round(number(input.workload.movesInFlightAtEnd, 10_000)),
      processPeakMovesInFlight: Math.round(number(input.workload.processPeakMovesInFlight, 10_000))
    }
  };
}

export function resetMoveRuntimeTelemetryForTests() {
  const state = globalRuntime.__binary2048_move_runtime_telemetry;
  state?.eventLoopHistogram?.disable();
  state?.gcObserver?.disconnect();
  delete globalRuntime.__binary2048_move_runtime_telemetry;
}
