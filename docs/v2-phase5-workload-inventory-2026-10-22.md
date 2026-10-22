# V2 Phase 5 research and compute workload inventory — 2026-10-22

## Scope and deployed baseline

This inventory closes only the second Phase 5 item. It covers all HTTP,
Lambda/SQS, and package-script entry points that run or prepare simulation,
tournament, training, model inference, replay ingest, or job-status work. The
machine-readable surface is `v2-phase5-workload-entrypoints.json`; provisioning,
report-only, key-generation, and audit commands are not workload entry points.

Production uses the accepted V1 shared-infrastructure baseline: Amplify hosts
the web routes, tournament and training requests submit to separate encrypted
SQS queues, and two on-demand 2 GB/60-second Lambda functions consume one
message per invocation with event-source maximum concurrency two. Jobs expire
after 24 hours, allow at most two execution attempts, limit serialized input to
128 KiB and stored result to 12 MiB, and share a 250-job UTC-month admission
budget. Each SQS queue retains messages for one day and moves a message to its
14-day dead-letter queue after three receives. There is no reserved or
provisioned worker concurrency.

The rate-limit store is the deployed shared Mongo store where the route opts
into it. Unless an environment override is present, the audited application
defaults below apply. Challenge policy defaults to `off`; `log` observes a
missing token without rejecting it, and `enforce` rejects these high-risk
routes without the configured challenge token. No challenge mode value or
secret is recorded here.

## HTTP entry points

| Entry point | Identification, authentication, and authorization | Quota and challenge | Body/cost and queue limits | Runtime and mutation |
| --- | --- | --- | --- | --- |
| `POST /api/simulate` | Public. A valid optional bot API key selects an API-key quota identity; otherwise verified account, then IP. It grants no scope. | `simulate`, 60/5 minutes by default, configurable with `BINARY2048_RATE_LIMIT_SIMULATE_MAX` and the shared window variable. High-risk challenge policy. | 128 KiB JSON; 1–2,000 moves. No queue. | Amplify; synchronous, deterministic, no application-data write beyond the quota counter. |
| `POST /api/bots/tournament` | Public; the same optional identification-only API key/account/IP order. No research scope. | `bots_tournament`, 10/5 minutes by default; tournament and window overrides. High-risk challenge policy. | No route-local byte cap. At most 100 seeds, 2,000 moves/run, and 2,500 trace decisions. Production creates an SQS job; inline fallback is 2 active + 8 waiting with a 15-second wait. | Amplify admission, tournament Lambda execution. Reserves monthly budget, inserts job, then stores result/status. |
| `GET /api/training/replays` | Public; optional identification-only API key/account/IP order. No research scope. | Shared `training` bucket, 20/5 minutes by default; training and window overrides. High-risk challenge policy. | Query `limit` clamped to 1–100. Production creates an SQS job; inline fallback is 1 active + 2 waiting with a 10-second wait. | Amplify admission, training Lambda execution. Reserves budget and mutates job state. |
| `GET /api/training/labels` | Same as training replays. | Same shared `training` bucket and high-risk challenge policy. | Query `limit` clamped to 1–500. Same training queue/fallback limits. | Same admission/worker placement and job mutations. |
| `GET /api/ops/models` | Requires either the constant-time `x-admin-token` service credential or verified auth-bridge claims whose subject is in `BINARY2048_ADMIN_SUBJECTS`. This is real admin authorization, unlike the bot API key. | No route-local quota or challenge. | Read capped by the registry implementation at 500 records; no request body or queue. | Amplify; reads shared Mongo model registry without mutation. It lists metadata and does not perform inference. |
| `POST /api/replay/ingest` | Public, with no authentication, authorization, API-key handling, or intended caller proof. | No route-local quota or challenge. | No route-local body-byte or record-count cap. Deduplicates only within one request. | Amplify; upserts caller-supplied canonical run records into the deployed run store. |
| `GET /api/jobs/{id}` | The random 256-bit lowercase-hex job id is a bearer capability. No owner binding or research scope is checked. | Reuses `game_move`: default floor 600/5 minutes (paid tier 1,800); only API-key counters use shared Mongo, while account/IP counters use instance memory. No challenge. | Exact 64-hex id, no body. Polling clients use 2-second intervals and a 12-minute deadline. | Amplify; reads a non-expired Mongo job. Only the quota counter mutates. |

`BINARY2048_RATE_LIMIT_WINDOW_MS` configures the simulation, tournament,
training, and move windows; invalid overrides fall back to five minutes. Rate
limits are request counts, not authorization grants or compute-cost budgets.

## Worker and script entry points

The SQS `workers/index.ts` handler accepts only a 64-hex job id, leases the
corresponding queued Mongo record, and dispatches exactly three task kinds:
`tournament`, `training-replays`, and `training-labels`. SQS/Lambda invocation
is controlled by AWS IAM, not an application scope. A lease is 90 seconds;
retry is delegated to SQS, and the handler does not run an unbounded local
retry loop.

The following operator commands have no independent route-local authorization
or quota. Commands that call Binary 2048 inherit the target HTTP route's
controls; notably, their current clients do not send a bot API key or challenge
token. Local file and direct AWS/Mongo commands instead rely on workstation,
credential, and filesystem access.

| Commands | Work performed and caps | Mutation |
| --- | --- | --- |
| `bot:smoke` (`bot:smoke:dev`) | Creates a game and makes up to `MAX_MOVES` (400 default). | Remote game/session state. |
| `bot:tourney` (`bot:tourney:dev`) | Calls tournament with 3 seeds and 250 moves by default, then polls a queued job. | Remote job/result state. |
| `bot:benchmark` | Calls tournament with 5 default seeds/250 moves and polls if queued. | Remote job plus local Markdown report. |
| `rollout:trace` | Calls traced rollout tournament for 5 default seeds/25 moves. Route trace cap remains authoritative. | Remote job plus local benchmark ledger. |
| `challenge:benchmark` | Runs rollout, local Ollama, or hosted scenarios. Hosted inference requires `CHALLENGE_ALLOW_HOSTED=1` and has a $1 estimated-cost default cap. | Remote games/jobs and local ledger/report. |
| `ollama:bot` (`ollama:check`) | Local Ollama inference; play defaults to 25 moves. `ollama:check` performs provider readiness only. | Remote game/job and local ledger when playing. |
| `hf:bot` | Hosted inference requires a provider token; defaults to 25 moves, bounded output tokens, and a $5 estimated-cost cap. | Remote game/job and local ledger. |
| `league:sandbox:sim` | Defaults to 8 players × 120 moves; league/admin credentials are passed to the relevant league calls. | Remote games and leaderboard submissions. |
| `models:export:dataset` | Converts the local benchmark ledger into dataset artifacts; no network queue. | Local dataset directory. |
| `runs:export:dataset` | Reads at most 5,000 Mongo run records by default and anonymizes player ids. | Local JSONL dataset. |
| `runs:extract:features` | Reads run JSONL and derives features. | Local feature JSONL. |
| `ml:baseline` | Computes the local baseline from feature JSONL. | Local JSON report. |
| `replay:ingest:worker` | Reads an operator-selected batch file and sends all records in one request; it adds no auth, quota, or batch cap. | Public replay-ingest route upserts run records. |
| `workers:acceptance` | Directly inserts one small job per worker task and sends SQS messages using operator AWS/Mongo credentials. | Production acceptance jobs and queue messages. |

## Security findings and next boundary

1. Simulation, tournament, and training are public. A configured bot API key
   is only a stable quota identity; there are no research-specific scopes.
2. Replay ingest is a public, unbounded write path. Its only shipped client is
   the operator batch script, but the route does not prove that contract. This
   inventory deliberately does not choose or change its authorization model.
3. Job status treats an unguessable id as a capability and reuses the move
   quota, including per-instance account/IP fallback behavior.
4. Tournament lacks a route-local body-byte cap even though the queued task is
   capped at 128 KiB. Offline and model clients have uneven local caps and do
   not forward the optional bot key or challenge token.

Scoped research/admin authorization, replay-ingest caller design, and hard
request/job caps remain the next Phase 5 item. No authorization behavior was
changed in this inventory slice.

## Drift coverage

`workload-entrypoint-inventory.test.ts` locks the reviewed 22-entry surface,
verifies every source and HTTP/worker export or package command, checks command
aliases, and preserves explicit tests for the three security boundaries above.
Changes to the workload surface or those controls now require a deliberate
inventory and test update.

## Validation and delivery-efficiency measurement

- Focused inventory validation passed: 1 suite / 3 tests.
- Full unit validation passed: 172 suites / 655 tests.
- Full local browser validation passed: 77 tests with two expected skips.
- Type generation and TypeScript checking passed.
- The optimized production compile and the post-build smoke passed. Existing
  lint warnings were unchanged.
- Discovery used 16 scoped source/configuration reads. One combined source
  read reported 5,895 tokens before output truncation, so this slice did not
  meet the aggregate 5,000-token batch rule and cannot close the measured 35%
  delivery-efficiency comparison.
- The focused test and full unit gate each ran once. The browser command ran
  three times: Chromium was first denied its macOS Mach registration by the
  sandbox, the host-level retry correctly exposed the documented missing dev
  server prerequisite, and the run passed after starting that server.
- Production compilation ran twice. The first compile succeeded but its smoke
  had not received the disposable auth environment at build time. The second
  compile used that environment; its in-sandbox smoke could not bind port
  4110, so only the already-built smoke harness was repeated outside the
  sandbox. No product defect or missed workload dependency was found.

V2 progress is 36/84 (42.9%), and whole-roadmap progress is 347/374 (93%).
The delivery-efficiency comparison remains open.

## Production acceptance

Runtime commit `950b804` deployed successfully in Amplify job 427. The watcher
enforced the full commit id, used four combined status/commit retrievals over
138 seconds, and reported success. The standard production smoke then passed
against `https://www.binary2048.com`.
