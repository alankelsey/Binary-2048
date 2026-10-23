# Binary-2048 Developer Guide

## Local Setup

```bash
npm install
npm run dev
```

Key local URLs:

- App: `http://localhost:3000`
- OpenAPI JSON: `http://localhost:3000/api/openapi`
- Interactive API explorer: `http://localhost:3000/api-docs`
- Replay viewer (share links): `http://localhost:3000/replay?code=...`

## Architecture Overview

- Next.js App Router app.
- Game engine and rules in `lib/binary2048/engine.ts`.
- Session orchestration in `lib/binary2048/sessions.ts`.
- API routes in `app/api/**`.
- OpenAPI source in `lib/binary2048/openapi.ts`.

## Replay Model

- Deterministic replay based on:
  - Seed
  - Move sequence
  - Locked replay header fields
- Header lock enforces:
  - `replayVersion`
  - `rulesetId`
  - `engineVersion`
  - `size`
  - `seed`
  - `createdAt`
- Export metadata includes normalized `stepLog` with:
  - `rngStepStart`/`rngStepEnd`
  - `scoreDelta`/`scoreTotal`
  - normalized event payloads

Replay storage phases and migration notes are documented in:

- `docs/replay-storage-strategy.md`

## API Surface (High Use)

- Game lifecycle:
  - `POST /api/games`
  - `GET /api/games/:id`
  - `POST /api/games/:id/move`
  - `POST /api/games/:id/undo`
- Replay:
  - `GET /api/games/:id/export`
  - `GET /api/games/:id/replay`
  - `POST /api/replay`
  - `POST /api/replay/postmortem`
  - `POST/GET /api/replay/code`
- Daily challenge:
  - `GET /api/challenges/daily`
  - `POST /api/challenges/daily/submit`
- Ghost race:
  - `GET /api/challenges/ghost-race`
  - `POST /api/challenges/ghost-race/submit`
- Run persistence:
  - `GET /api/runs/:id`
  - `GET /api/runs/:id/replay`
  - Index + latency SLO doc: `docs/run-index-slo.md`
  - Replay retention policy: `docs/replay-retention-policy.md`
- AI:
  - `GET /api/games/:id/encoded`
  - `POST /api/simulate`
  - `POST /api/bots/tournament`
- Economy/Auth:
  - `POST /api/auth/dev-token`
  - `POST /api/auth/entitlements/proof`
  - `POST /api/leaderboard/submit`
  - `GET /api/leaderboard`

See `/api/openapi` for up-to-date route definitions.

## Research API authorization and caps

Simulation, tournament, training, replay ingestion, and queued-job status are
not public APIs. They require one of the following:

- an `x-api-key` whose key id is present in `BINARY2048_BOT_API_KEY_SCOPES`
  with the operation's exact scope;
- a verified auth-bridge subject listed in `BINARY2048_RESEARCH_SUBJECTS`; or
- existing admin authority (`x-admin-token` or an allowed verified admin
  subject).

`BINARY2048_BOT_API_KEY_HASHES` identifies a key for quota accounting only. It
does not grant access. Authorization is configured separately as comma-separated
`id=scope|scope` entries in `BINARY2048_BOT_API_KEY_SCOPES`. Generate a new key
and both configuration entries with:

```bash
npm run bot:key:generate -- operator-id 'tournament:run|jobs:read'
```

Production scope grants are applied without printing credential material via
`BINARY2048_BOT_SCOPE_GRANTS='id=scope|scope' python3
scripts/configure-v1-production.py`; the configurator preserves all unrelated
Amplify variables.

Operator HTTP clients read `BINARY2048_API_KEY` and optionally
`BINARY2048_CHALLENGE_TOKEN`; queued-job polling and result retrieval forward
the same headers. Production simulation, tournament, and training requests
return `202` with `jobId`, `statusUrl`, and `resultUrl`. Poll `statusUrl` no
faster than the returned retry interval, then fetch `resultUrl` after status is
`complete`. Send `x-binary2048-job-contract: 2` for lightweight status. An
unversioned status request temporarily retains the completed inline `result`
field for older clients; new clients use the dedicated result API. Local development
without SQS keeps the bounded synchronous fallback for deterministic testing.
Replay ingestion is specifically an operator batch-import contract: the worker
splits its selected file into requests of at most 100 records and 900 KiB.

Hard server limits are 128 KiB and 2,000 moves for simulation; 128 KiB, 100
seeds, 2,000 moves/run, 25,000 aggregate decisions, and 2,500 trace decisions for tournament; 100 replay
rows or 500 label rows per training request; and 1 MiB/100 records for replay
ingestion. Queued work also has a 25-job daily allowance per principal, the
existing 250-job shared monthly allowance, two execution attempts, and a
24-hour TTL and 12 MiB stored-result cap. Job status and result reads share the
120 requests per five-minute polling quota.

New queued jobs are bound to the submitting principal. Admins may inspect any
job. Ownerless jobs created before this boundary was deployed retain the old
opaque-id capability only until their existing 24-hour expiry, avoiding a
mid-flight rollout break without keeping opaque capability semantics for new
work.

The explorer is generated from the same in-process OpenAPI object as
`/api/openapi`. It can filter operations and expand their parameters, request
body status, authentication, authorization scopes, rate-limit policy,
schema/version compatibility, safe examples, and documented responses. A route-contract test compares every
explicitly exported App Router HTTP handler with the published operations, so
adding or removing a handler requires updating the contract in the same
change. The Auth.js catch-all route remains framework-owned and outside this
application contract.

The canonical contract also publishes reusable `botApiKey`, `bearerAuth`,
`adminBearer`, and `authSession` security schemes plus shared error,
rate-limit, job, state-identity, and replay schemas. The explorer is read-only;
it never sends credentials or executes privileged or mutating operations.

The complete research/compute surface, including SQS/Lambda and executable
scripts that are outside OpenAPI, is inventoried in
`docs/v2-phase5-workload-inventory-2026-10-22.md`. A machine-readable companion
and drift test require new workload entry points and the current security
boundaries to be reviewed deliberately.

## Testing

```bash
npm run test:unit
npm run test:unit:concise
npm run test:ui:concise
npm run test:delivery-tools
npm run test:all
npm run mongo:smoke
```

Use the concise commands for delivery work. They preserve the underlying exit
status and print complete failures with one final count, while avoiding output
for every passing suite. During implementation, pass affected test paths after
`--`; run the full release matrix once the candidate is stable.

Current suite includes:

- Engine rule tests
- Replay parsing/audit and schema lock tests
- API route tests
- Bot orchestration tests
- ML utility tests (feature extraction, model registry, inference safety gate)

## Environment Notes

- Dev auth helper requires:
  - `BINARY2048_ENABLE_DEV_AUTH_TOKEN=1`
  - `BINARY2048_AUTH_BRIDGE_SECRET`
- Replay code signing:
  - `BINARY2048_REPLAY_CODE_SECRET`
- Entitlement proof flow:
  - `BINARY2048_ENTITLEMENT_SECRET`

## Operational Pointers

- WAF helpers and templates live in `docs/` + `scripts/`.
- Use `npm run roadmap:status` to check roadmap progress.
- Keep `tsconfig.json` stable (avoid committing transient `.next-dev-####` paths).
- Bot integration docs:
  - `docs/bot-api-quickstart.md`
  - `docs/bot-benchmark-suite.md`
  - `docs/mongo-migration-triggers.md`
- ML pipeline docs:
  - `docs/ml-pipeline.md`
