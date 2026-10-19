import {
  createDiagnosticRingBuffer,
  diagnosticValue,
  formatDiagnosticEntries,
  redactDiagnosticText
} from "@/lib/binary2048/diagnostics";

describe("diagnostics", () => {
  it("retains the newest entries in chronological order within a fixed capacity", () => {
    const buffer = createDiagnosticRingBuffer(3);
    for (let sequence = 1; sequence <= 5; sequence += 1) {
      buffer.push({ sequence, atISO: `time-${sequence}`, level: "info", event: `event-${sequence}` });
    }

    expect(buffer.capacity).toBe(3);
    expect(buffer.size).toBe(3);
    expect(buffer.snapshot().map((entry) => entry.sequence)).toEqual([3, 4, 5]);
    buffer.clear();
    expect(buffer.size).toBe(0);
    expect(buffer.snapshot()).toEqual([]);
  });

  it("rejects invalid capacities", () => {
    expect(() => createDiagnosticRingBuffer(0)).toThrow("Diagnostic capacity must be positive");
    expect(() => createDiagnosticRingBuffer(1.5)).toThrow("Diagnostic capacity must be positive");
  });

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
