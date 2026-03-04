import { getOpsTelemetrySnapshot, recordRouteTelemetry, resetOpsTelemetry } from "@/lib/binary2048/ops-telemetry";

describe("ops-telemetry", () => {
  beforeEach(() => {
    resetOpsTelemetry();
    delete process.env.BINARY2048_TELEMETRY_LATENCY_WARN_MS;
    delete process.env.BINARY2048_TELEMETRY_ERROR_RATE_WARN_PCT;
    delete process.env.BINARY2048_TELEMETRY_COST_WARN_UNITS;
  });

  it("records route metrics and computes latency percentiles", () => {
    recordRouteTelemetry({ route: "/api/bots/tournament", status: 200, durationMs: 20, costUnits: 5 });
    recordRouteTelemetry({ route: "/api/bots/tournament", status: 500, durationMs: 100, costUnits: 5 });
    const snapshot = getOpsTelemetrySnapshot();
    const metric = snapshot.routes.find((item) => item.route === "/api/bots/tournament");
    expect(metric).toBeTruthy();
    expect(metric?.calls).toBe(2);
    expect(metric?.errors).toBe(1);
    expect(metric?.p95DurationMs).toBeGreaterThanOrEqual(20);
    expect(metric?.totalCostUnits).toBe(10);
  });

  it("flags anomaly markers when thresholds are exceeded", () => {
    process.env.BINARY2048_TELEMETRY_LATENCY_WARN_MS = "10";
    process.env.BINARY2048_TELEMETRY_ERROR_RATE_WARN_PCT = "10";
    process.env.BINARY2048_TELEMETRY_COST_WARN_UNITS = "1";
    recordRouteTelemetry({ route: "/api/replay/validate", status: 500, durationMs: 50, costUnits: 2 });
    const snapshot = getOpsTelemetrySnapshot();
    const metric = snapshot.routes.find((item) => item.route === "/api/replay/validate");
    expect(metric?.anomalies).toEqual(
      expect.arrayContaining(["latency_spike", "error_rate_spike", "cost_spike"])
    );
  });
});

