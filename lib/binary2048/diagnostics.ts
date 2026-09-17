export type DiagnosticLevel = "info" | "warn" | "error";

export type DiagnosticEntry = {
  sequence: number;
  atISO: string;
  level: DiagnosticLevel;
  event: string;
  details?: Record<string, string | number | boolean | null>;
};

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

export function formatDiagnosticEntries(entries: DiagnosticEntry[]): string {
  if (entries.length === 0) return "No diagnostics recorded.";
  return entries
    .map((entry) => {
      const details = entry.details
        ? ` ${Object.entries(entry.details)
            .map(([key, value]) => `${key}=${diagnosticValue(value)}`)
            .join(" ")}`
        : "";
      return `${entry.sequence} ${entry.atISO} ${entry.level.toUpperCase()} ${entry.event}${details}`;
    })
    .join("\n");
}
