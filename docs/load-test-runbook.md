# Load Test Runbook

This runbook defines baseline, ramp, spike, and soak tests for Binary-2048 before public launch.

## Tooling

Install k6 once:

```bash
brew install k6
k6 version
```

## Targets

- Local: `BASE_URL=http://localhost:3000`
- Prod: `BASE_URL=https://www.binary2048.com`

## Quick Start

```bash
BASE_URL=http://localhost:3000 npm run load:baseline
BASE_URL=http://localhost:3000 npm run load:ramp
BASE_URL=http://localhost:3000 npm run load:spike
BASE_URL=http://localhost:3000 SOAK_DURATION=10m SOAK_VUS=30 npm run load:soak
```

No-k6 staged gameplay check (writes pass/fail evidence to `docs/load-results/`):

```bash
BASE_URL=http://localhost:3000 npm run load:stage:gameplay
```

No-k6 staged heavy abuse check (invalid/oversized payload mix):

```bash
BASE_URL=http://localhost:3000 npm run load:stage:abuse
```

## Profiles

- `load:baseline`
  - 10 VUs for 2 minutes
  - gameplay-heavy sanity profile
- `load:ramp`
  - staged growth to 150 VUs
  - mixed gameplay + bounded `/api/simulate`
- `load:spike`
  - sudden jump to 300 VUs
  - includes heavy route pressure (`/api/bots/tournament`)
- `load:soak`
  - long duration steady-state (default 40 VUs for 30m)
  - override with `SOAK_DURATION` and `SOAK_VUS`

## Acceptance Gates (initial)

- Baseline:
  - `http_req_failed < 1%`
  - `p95 < 400ms`
- Ramp:
  - `http_req_failed < 2%`
  - `p95 < 600ms`
- Spike:
  - `http_req_failed < 5%`
  - `p95 < 1200ms`
- Soak:
  - `http_req_failed < 2%`
  - `p95 < 800ms`

## Evidence to capture

For each profile store:

- k6 summary output
- route-level p95/p99 from app telemetry (`/api/ops/telemetry`)
- WAF request/action deltas
- CloudWatch cost/usage snapshots during test window

Staged gameplay script writes:

- `docs/load-results/staged-gameplay-latest.json`
- `docs/load-results/staged-gameplay-latest.md`

Staged heavy abuse script writes:

- `docs/load-results/heavy-abuse-latest.json`
- `docs/load-results/heavy-abuse-latest.md`

## Notes

- Heavy endpoints are expected to return bounded protection responses (`429`, `503`, `403`) under pressure.
- Failing closed with bounded error responses is preferred over latency collapse.
- Run local first, then staging/prod off-peak.
