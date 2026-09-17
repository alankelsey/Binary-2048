import {
  diagnosticValue,
  formatDiagnosticEntries,
  redactDiagnosticText
} from "@/lib/binary2048/diagnostics";

describe("diagnostics", () => {
  it("formats chronological move details for copy and paste", () => {
    expect(
      formatDiagnosticEntries([
        {
          sequence: 7,
          atISO: "2026-09-17T02:30:56.631Z",
          level: "info",
          event: "move_response",
          details: { dir: "left", status: 200, turn: 4, recoveryMoves: 4 }
        }
      ])
    ).toBe(
      "7 2026-09-17T02:30:56.631Z INFO move_response dir=left status=200 turn=4 recoveryMoves=4"
    );
  });

  it("redacts credentials and recovery signatures", () => {
    const raw = 'authorization=Bearer abc.def signature="signed-value" token=secret-token';
    const redacted = redactDiagnosticText(raw);
    expect(redacted).not.toContain("abc.def");
    expect(redacted).not.toContain("signed-value");
    expect(redacted).not.toContain("secret-token");
    expect(redacted).toContain("[redacted]");
  });

  it("serializes errors and circular values safely", () => {
    expect(diagnosticValue(new Error("network failed"))).toBe("Error: network failed");
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(diagnosticValue(circular)).toBe("[object Object]");
  });
});
