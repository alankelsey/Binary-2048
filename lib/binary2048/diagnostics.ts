export type DiagnosticLevel = "info" | "warn" | "error";

export type DiagnosticEntry = {
  sequence: number;
  atISO: string;
  level: DiagnosticLevel;
  event: string;
  details?: Record<string, string | number | boolean | null>;
};

export type DiagnosticRingBuffer = {
  readonly capacity: number;
  readonly size: number;
  push(entry: DiagnosticEntry): void;
  clear(): void;
  snapshot(): DiagnosticEntry[];
};

export function createDiagnosticRingBuffer(capacity = 250): DiagnosticRingBuffer {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Diagnostic capacity must be positive");
  const entries = new Array<DiagnosticEntry>(capacity);
  let start = 0;
  let size = 0;

  return {
    capacity,
    get size() { return size; },
    push(entry) {
      const index = (start + size) % capacity;
      entries[index] = entry;
      if (size < capacity) size += 1;
      else start = (start + 1) % capacity;
    },
    clear() {
      start = 0;
      size = 0;
    },
    snapshot() {
      return Array.from({ length: size }, (_, index) => entries[(start + index) % capacity]);
    }
  };
}

const CRITICAL_EVENTS = new Set([
  "state_regression_detected",
  "slow_acknowledgement",
  "prediction_reconciliation",
  "recovery_fallback",
  "input_drop_counts"
]);

export function shouldRetainDiagnostic(
  event: string,
  level: DiagnosticLevel,
  details: DiagnosticEntry["details"],
  detailedSuccessTracing: boolean
) {
  if (level === "error" || level === "warn") return true;
  if (event === "prediction_reconciliation") return details?.classification !== "match";
  return CRITICAL_EVENTS.has(event) || detailedSuccessTracing;
}

const PRIVATE_DETAIL_KEY = /(?:^|_)(?:id|gameid|sessionid|userid|accountid|email|hash|token|authorization|signature|secret|password|payload|body)$/i;

export function sanitizeDiagnosticDetails(details?: DiagnosticEntry["details"]): DiagnosticEntry["details"] {
  if (!details) return undefined;
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !PRIVATE_DETAIL_KEY.test(key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)))
  );
}

const SENSITIVE_VALUE = /("?(?:authorization|token|signature|secret|password)"?\s*[:=]\s*)("[^"\s]*"|[^,\s}]+)/gi;
const BEARER_VALUE = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function redactDiagnosticText(value: string): string {
  return value
    .replace(BEARER_VALUE, "Bearer [redacted]")
    .replace(SENSITIVE_VALUE, "$1[redacted]");
}

export function diagnosticValue(value: unknown): string {
  if (value instanceof Error) return redactDiagnosticText(`${value.name}: ${value.message}`);
  if (typeof value === "string") return redactDiagnosticText(value);
  try {
    return redactDiagnosticText(JSON.stringify(value));
  } catch {
    return redactDiagnosticText(String(value));
  }
}
