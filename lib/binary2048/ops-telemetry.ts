type RouteMetric = {
  route: string;
  calls: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
  lastStatus: number;
  lastSeenISO: string;
  recentDurationsMs: number[];
  totalCostUnits: number;
};

type TelemetryStore = {
  routes: Map<string, RouteMetric>;
  startedAtISO: string;
};

const MAX_RECENT_DURATIONS = 200;

const globalStore = globalThis as typeof globalThis & {
  __binary2048_ops_telemetry?: TelemetryStore;
};

const telemetry: TelemetryStore = globalStore.__binary2048_ops_telemetry ?? {
  routes: new Map<string, RouteMetric>(),
  startedAtISO: new Date().toISOString()
};
globalStore.__binary2048_ops_telemetry = telemetry;

function sorted(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const ordered = sorted(values);
  const idx = Math.max(0, Math.min(ordered.length - 1, Math.ceil((p / 100) * ordered.length) - 1));
  return ordered[idx];
}

function routeMetric(route: string): RouteMetric {
  const existing = telemetry.routes.get(route);
  if (existing) return existing;
  const created: RouteMetric = {
    route,
    calls: 0,
    errors: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    lastStatus: 0,
    lastSeenISO: new Date(0).toISOString(),
    recentDurationsMs: [],
    totalCostUnits: 0
  };
  telemetry.routes.set(route, created);
  return created;
}

function parseThreshold(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

export function recordRouteTelemetry(input: {
  route: string;
  status: number;
  durationMs: number;
  costUnits?: number;
}) {
  const metric = routeMetric(input.route);
  const durationMs = Math.max(0, Number(input.durationMs) || 0);
  const costUnits = Math.max(0, Number(input.costUnits) || 0);
  metric.calls += 1;
  if (input.status >= 400) metric.errors += 1;
  metric.totalDurationMs += durationMs;
  metric.maxDurationMs = Math.max(metric.maxDurationMs, durationMs);
  metric.lastStatus = input.status;
  metric.lastSeenISO = new Date().toISOString();
  metric.totalCostUnits += costUnits;
  metric.recentDurationsMs.push(durationMs);
  if (metric.recentDurationsMs.length > MAX_RECENT_DURATIONS) {
    metric.recentDurationsMs.splice(0, metric.recentDurationsMs.length - MAX_RECENT_DURATIONS);
  }
}

export function getOpsTelemetrySnapshot() {
  const latencyWarnMs = parseThreshold(process.env.BINARY2048_TELEMETRY_LATENCY_WARN_MS, 1500);
  const errorRateWarnPct = parseThreshold(process.env.BINARY2048_TELEMETRY_ERROR_RATE_WARN_PCT, 20);
  const costWarnUnits = parseThreshold(process.env.BINARY2048_TELEMETRY_COST_WARN_UNITS, 10000);

  const routes = Array.from(telemetry.routes.values())
    .map((metric) => {
      const avgDurationMs = metric.calls > 0 ? metric.totalDurationMs / metric.calls : 0;
      const p95DurationMs = percentile(metric.recentDurationsMs, 95);
      const errorRatePct = metric.calls > 0 ? (metric.errors / metric.calls) * 100 : 0;
      const anomalies: string[] = [];
      if (p95DurationMs >= latencyWarnMs) anomalies.push("latency_spike");
      if (errorRatePct >= errorRateWarnPct) anomalies.push("error_rate_spike");
      if (metric.totalCostUnits >= costWarnUnits) anomalies.push("cost_spike");
      return {
        route: metric.route,
        calls: metric.calls,
        errors: metric.errors,
        errorRatePct: Number(errorRatePct.toFixed(2)),
        avgDurationMs: Number(avgDurationMs.toFixed(2)),
        p95DurationMs: Number(p95DurationMs.toFixed(2)),
        maxDurationMs: Number(metric.maxDurationMs.toFixed(2)),
        totalCostUnits: Number(metric.totalCostUnits.toFixed(2)),
        lastStatus: metric.lastStatus,
        lastSeenISO: metric.lastSeenISO,
        anomalies
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));

  return {
    startedAtISO: telemetry.startedAtISO,
    generatedAtISO: new Date().toISOString(),
    thresholds: {
      latencyWarnMs,
      errorRateWarnPct,
      costWarnUnits
    },
    routes
  };
}

export function resetOpsTelemetry() {
  telemetry.routes.clear();
  telemetry.startedAtISO = new Date().toISOString();
}

