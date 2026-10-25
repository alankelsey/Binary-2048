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

Validate the paired gameplay/worker-isolation envelope without sending load:

```bash
WORKER_ISOLATION_VALIDATE_ONLY=1 npm run load:worker-isolation
```

The deployed paired test is operator-only. It refuses every external target
unless `ALLOW_PRODUCTION_LOAD=1` is explicit, caps gameplay at four clients and
25 moves per client plus 42 fixed browser warmup/sample moves, and caps workers
at two jobs in each isolated class. Run it only in an approved quiet window and
keep its summarized result:

```bash
BASE_URL=https://www.binary2048.com \
ALLOW_PRODUCTION_LOAD=1 \
WORKER_ISOLATION_OUTPUT=docs/load-results/gameplay-worker-isolation-latest.json \
npm run load:worker-isolation
```

The operator must have read/write access to the deployed worker queues and job
store. The script uses fixed task shapes at the public aggregate-compute caps,
records no credential or generated artifact, and deletes its job/artifact
records in a `finally` cleanup.

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

The paired worker-isolation script writes only when
`WORKER_ISOLATION_OUTPUT` is set, and only below `docs/load-results/`. Its
summary includes the baseline/loaded browser p95 values, HTTP move p95 values,
worker-overlap observation, attempt counts, and predeclared gate results.

## Notes

- Heavy endpoints are expected to return bounded protection responses (`429`, `503`, `403`) under pressure.
- Failing closed with bounded error responses is preferred over latency collapse.
- Run local first, then staging/prod off-peak.
