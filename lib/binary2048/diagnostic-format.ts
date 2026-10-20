import { diagnosticValue, type DiagnosticEntry } from "@/lib/binary2048/diagnostics";

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
