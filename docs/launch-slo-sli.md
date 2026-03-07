# Launch SLO/SLI Targets

This document defines launch reliability targets and failure thresholds for Binary-2048 public rollout.

## Scope

Primary routes included in launch SLOs:

- `POST /api/games`
- `POST /api/games/:id/move`
- `GET /api/health`

Secondary (heavy/guarded) routes tracked separately:

- `POST /api/simulate`
- `POST /api/bots/tournament`

## SLIs

- Availability: successful HTTP responses for gameplay routes (2xx/4xx expected contract responses).
- Latency: p50/p95/p99 request duration by route.
- Error rate: fraction of 5xx responses by route.
- Saturation: rate of bounded protection responses (`429`, `503`) on heavy routes.

## Launch SLOs

### Gameplay SLOs (hard)

- Availability: `>= 99.9%`
- Latency p50: `< 150ms`
- Latency p95: `< 400ms`
- Latency p99: `< 900ms`
- 5xx error rate: `< 0.5%`

### Heavy-route SLOs (guarded)

- `POST /api/simulate` p95: `< 900ms` under planned load profile
- `POST /api/bots/tournament` p95: `< 1500ms` when queue not saturated
- Queue protection correctness: under overload, bounded responses (`429`/`503`) must dominate over 5xx failures

## Failure Gates (no-go)

Do not proceed with public campaign if any are true in staged tests:

- Gameplay p95 exceeds `400ms` for sustained `>= 5 minutes`
- Gameplay 5xx exceeds `0.5%` for sustained `>= 5 minutes`
- Any unbounded latency collapse (timeouts) under spike profile
- Billing anomaly alarms trigger during baseline/ramp profile

## Observability Sources

- App route telemetry: `GET /api/ops/telemetry`
- WAF metrics/logs (allow/block/challenge counts)
- CloudWatch latency/error dashboards and alarms
- Cost/budget alarms and tripwire notifications

## Review Cadence

- Pre-launch: run baseline, ramp, spike, soak profiles before each major release.
- Post-launch week 1: daily review of p95/p99 and 5xx by route.
- Ongoing: weekly SLO review and threshold tuning.

## Ownership

- Service owner reviews SLO health before feature launches.
- Incident owner records deviations and corrective actions in postmortem.
