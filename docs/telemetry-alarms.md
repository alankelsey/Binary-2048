# Telemetry And Anomaly Visibility

## Scope

This app now records lightweight route telemetry for high-cost replay/tournament endpoints and exposes it via:

- `GET /api/ops/telemetry`

## Current Instrumented Routes

- `/api/bots/tournament`
- `/api/replay/validate`

Each route tracks:

- calls
- errors
- error rate %
- avg/p95/max duration
- total cost units (coarse estimate)
- anomaly flags

## Built-in Anomaly Flags

- `latency_spike`
- `error_rate_spike`
- `cost_spike`

Threshold env vars:

- `BINARY2048_TELEMETRY_LATENCY_WARN_MS` (default `1500`)
- `BINARY2048_TELEMETRY_ERROR_RATE_WARN_PCT` (default `20`)
- `BINARY2048_TELEMETRY_COST_WARN_UNITS` (default `10000`)

## Operational Use

1. Poll `/api/ops/telemetry` on a schedule.
2. Alert when any route has non-empty `anomalies`.
3. Correlate spikes with WAF logs and rate-limit events.

