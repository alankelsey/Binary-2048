export type MoveInputSource = "keyboard" | "touch" | "control";

export type MovePerformancePhase =
  | "input_capture"
  | "accepted"
  | "queued"
  | "local_engine_not_run"
  | "request_start"
  | "response_headers"
  | "response_parse_start"
  | "response_parse_end"
  | "react_commit"
  | "next_animation_frame";

type PerformanceEntryLike = { name: string };

export type MovePerformanceTarget = {
  now(): number;
  mark(name: string, options?: { detail?: unknown }): unknown;
  measure(name: string, options: { start: number; end: number; detail?: unknown }): unknown;
  clearMarks(name?: string): void;
  clearMeasures(name?: string): void;
  getEntriesByName(name: string): PerformanceEntryLike[];
};

export type MovePerformanceTrace = {
  id: string;
  direction: string;
  source: MoveInputSource;
  phases: Array<{
    phase: MovePerformancePhase;
    atMs: number;
    attempt?: number;
  }>;
};

export const MOVE_PERFORMANCE_COMPLETE_MARK = "binary2048:move-complete";
export const MOVE_PERFORMANCE_MEASURE = "binary2048:move-input-to-next-frame";
const MAX_COMPLETED_ENTRIES = 100;
let nextTraceSequence = 0;

function browserPerformance(): MovePerformanceTarget | null {
  if (typeof performance === "undefined") return null;
  if (
    typeof performance.mark !== "function" ||
    typeof performance.measure !== "function" ||
    typeof performance.clearMarks !== "function" ||
    typeof performance.clearMeasures !== "function" ||
    typeof performance.getEntriesByName !== "function"
  ) return null;
  return performance;
}

function markName(trace: MovePerformanceTrace, phase: MovePerformancePhase, attempt?: number) {
  return `binary2048:move:${trace.id}:${phase}${attempt ? `:${attempt}` : ""}`;
}

function trimCompletedEntries(target: MovePerformanceTarget) {
  if (target.getEntriesByName(MOVE_PERFORMANCE_COMPLETE_MARK).length >= MAX_COMPLETED_ENTRIES) {
    target.clearMarks(MOVE_PERFORMANCE_COMPLETE_MARK);
  }
  if (target.getEntriesByName(MOVE_PERFORMANCE_MEASURE).length >= MAX_COMPLETED_ENTRIES) {
    target.clearMeasures(MOVE_PERFORMANCE_MEASURE);
  }
}

export function startMovePerformanceTrace(
  direction: string,
  source: MoveInputSource,
  target: MovePerformanceTarget | null = browserPerformance()
): MovePerformanceTrace {
  nextTraceSequence += 1;
  const trace: MovePerformanceTrace = {
    id: `${nextTraceSequence.toString(36)}-${Math.round(target?.now() ?? 0).toString(36)}`,
    direction,
    source,
    phases: []
  };
  markMovePerformancePhase(trace, "input_capture", undefined, target);
  return trace;
}

export function markMovePerformancePhase(
  trace: MovePerformanceTrace,
  phase: MovePerformancePhase,
  attempt?: number,
  target: MovePerformanceTarget | null = browserPerformance()
) {
  if (!target) return;
  const atMs = target.now();
  trace.phases.push({ phase, atMs, ...(attempt ? { attempt } : {}) });
  target.mark(markName(trace, phase, attempt), {
    detail: { traceId: trace.id, direction: trace.direction, source: trace.source, phase, attempt: attempt ?? null }
  });
}

export function discardMovePerformanceTrace(
  trace: MovePerformanceTrace,
  target: MovePerformanceTarget | null = browserPerformance()
) {
  if (!target) return;
  for (const phase of trace.phases) {
    target.clearMarks(markName(trace, phase.phase, phase.attempt));
  }
}

export function finishMovePerformanceTrace(
  trace: MovePerformanceTrace,
  target: MovePerformanceTarget | null = browserPerformance()
) {
  if (!target) return;
  markMovePerformancePhase(trace, "next_animation_frame", undefined, target);
  const first = trace.phases[0];
  const last = trace.phases.at(-1);
  if (!first || !last) return;

  trimCompletedEntries(target);
  const detail = {
    traceId: trace.id,
    direction: trace.direction,
    source: trace.source,
    localEngineStatus: "not_run",
    phases: trace.phases.map((phase) => ({ ...phase }))
  };
  target.measure(MOVE_PERFORMANCE_MEASURE, { start: first.atMs, end: last.atMs, detail });
  target.mark(MOVE_PERFORMANCE_COMPLETE_MARK, { detail });
  discardMovePerformanceTrace(trace, target);
}
