# V2 Phase 5 research and compute workload inventory — 2026-10-22

## Scope and deployed baseline

This inventory closed the second Phase 5 item and was updated through the
scoped authorization/cap, asynchronous-job, worker-isolation, and generated-
artifact boundaries from the third through sixth items. It covers all HTTP,
Lambda/SQS, and package-script entry points that run or prepare simulation,
tournament, training, model inference, replay ingest, or job-status work. The
machine-readable surface is `v2-phase5-workload-entrypoints.json`; provisioning,
report-only, key-generation, and audit commands are not workload entry points.

Production uses the accepted V1 shared-infrastructure baseline: Amplify hosts
the web routes, simulation/tournament and training requests submit to separate encrypted
SQS queues, and two on-demand 2 GB/60-second Lambda functions consume one
message per invocation with event-source maximum concurrency two. Jobs expire
after 24 hours, allow at most two execution attempts, limit serialized input to
128 KiB and stored artifact to 12 MiB, share a 250-job UTC-month admission
budget, and cap each submitting principal at 25 jobs per UTC day. Each SQS
queue retains messages for one day and moves a message to its
14-day dead-letter queue after three receives. There is no reserved or
provisioned worker concurrency because the audited regional concurrency quota
cannot retain AWS's required unreserved pool after a reservation. The SQS
event-source mappings independently cap each pool at two concurrent
invocations. Compute admits at most 150 jobs/month and training 100/month under
the unchanged 250-job global cap. Twelve pool-specific alarms cover Lambda
errors, throttles, duration, concurrency plus queue age and DLQ depth.

The rate-limit store is the deployed shared Mongo store where the route opts
into it. Unless an environment override is present, the audited application
defaults below apply. Challenge policy defaults to `off`; `log` observes a
missing token without rejecting it, and `enforce` rejects these high-risk
routes without the configured challenge token. No challenge mode value or
secret is recorded here.

## HTTP entry points

| Entry point | Identification, authentication, and authorization | Quota and challenge | Body/cost and queue limits | Runtime and mutation |
| --- | --- | --- | --- | --- |
| `POST /api/simulate` | Requires `simulation:run`, configured research subject, or admin. Key identity and scope grants are separate. | `simulate`, 60/5 minutes by default, configurable with `BINARY2048_RATE_LIMIT_SIMULATE_MAX` and the shared window variable. High-risk challenge policy. | 128 KiB JSON; 1–2,000 moves. Production creates a job; compute class 150/month; bounded synchronous fallback is local-development only. | Amplify admission, isolated compute Lambda execution. Reserves principal, class, and global budgets, inserts an owned job, then stores result/status. |
| `POST /api/bots/tournament` | Requires `tournament:run`, configured research subject, or admin. | `bots_tournament`, 10/5 minutes by default; tournament and window overrides. High-risk challenge policy. | 128 KiB; at most 100 seeds, 2,000 moves/run, 25,000 aggregate decisions, and 2,500 trace decisions; compute class 150/month. Production creates an SQS job; inline fallback is 2 active + 8 waiting with a 15-second wait. | Amplify admission, isolated compute Lambda execution. Reserves principal, class, and global budgets, inserts an owned job, then stores result/status. |
| `GET /api/training/replays` | Requires `training:read`, configured research subject, or admin. | Shared `training` bucket, 20/5 minutes by default; training and window overrides. High-risk challenge policy. | Query `limit` clamped to 1–100; training class 100/month. Production creates an SQS job; inline fallback is 1 active + 2 waiting with a 10-second wait. | Amplify admission, isolated training Lambda execution. Reserves principal, class, and global budgets and mutates an owned job. |
| `GET /api/training/labels` | Same as training replays. | Same shared `training` bucket and high-risk challenge policy. | Query `limit` clamped to 1–500; training class 100/month. Same training queue/fallback limits. | Same isolated training placement and owned-job mutations. |
| `GET /api/ops/models` | Requires either the constant-time `x-admin-token` service credential or verified auth-bridge claims whose subject is in `BINARY2048_ADMIN_SUBJECTS`. This is real admin authorization, unlike the bot API key. | No route-local quota or challenge. | Read capped by the registry implementation at 500 records; no request body or queue. | Amplify; reads shared Mongo model registry without mutation. It lists metadata and does not perform inference. |
| `POST /api/replay/ingest` | Requires `replay:ingest`, configured research subject, or admin; its shipped caller is the operator batch-import worker. | `replay_ingest`, 10/5 minutes by default. | 1 MiB and 100 canonical records/request; the client chunks at 900 KiB/100. | Amplify; upserts caller-supplied canonical run records into the deployed run store. |
| `GET /api/jobs/{id}` | Requires `jobs:read` and the submitting principal; admin may inspect any job. Ownerless pre-deployment jobs retain opaque-id access only through their existing 24-hour TTL. | Dedicated `job_status`, shared 120/5 minutes. | Exact 64-hex id, no body. Polling clients use 2-second intervals and a 12-minute deadline. Contract-v2 status reads bounded metadata only; unversioned requests retain inline response compatibility by loading the stored artifact. | Amplify; reads a non-expired Mongo job and only reads a verified artifact for legacy compatibility. Only the quota counter mutates. |
| `GET /api/jobs/{id}/result` | Same scope, owner, admin, and ownerless-job compatibility rules as status. | Shares `job_status`, 120/5 minutes. | Exact 64-hex id; 202 pending, 200 complete, 409 failed; `worker-result-v1` expires with the 24-hour job TTL and is capped at 12 MiB. | Amplify; authorizes the job, then reads and verifies its separate Mongo artifact without regeneration. Only the quota counter mutates. |

`BINARY2048_RATE_LIMIT_WINDOW_MS` configures the simulation, tournament,
training, and move windows; invalid overrides fall back to five minutes. Rate
limits are request counts, not authorization grants or compute-cost budgets.

## Worker and script entry points

The SQS `workers/index.ts` handler accepts only a 64-hex job id, leases the
corresponding queued Mongo record, and dispatches exactly four task kinds:
`simulation`, `tournament`, `training-replays`, and `training-labels`. SQS/Lambda invocation
is controlled by AWS IAM, not an application scope. A lease is 90 seconds;
retry is delegated to SQS, and the handler does not run an unbounded local
retry loop. Each successful worker serializes its result once, enforces the
12 MiB ceiling, persists an owner-bound checksummed record in
`worker_artifacts`, and only then marks the job complete with bounded artifact
metadata. Both collections share the same absolute expiry through TTL indexes.
Missing or corrupt artifacts fail closed; the web runtime does not rebuild
them. Pre-change inline results retain their existing 24-hour compatibility
window. See `v2-phase5-generated-artifacts-2026-10-24.md`.

The deployed isolation and alarm decisions are maintained in
`v2-phase5-worker-isolation-budgets-2026-10-24.md`. Amplify gameplay and the
worker Lambda functions use different compute planes. Mongo remains a shared
downstream dependency. The later controlled production observation has now
passed and is recorded in
`v2-phase5-gameplay-worker-load-2026-10-25.md`; this supersedes the original
deferred-proof note without changing the inventory's authorization findings.

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
| `replay:ingest:worker` | Reads an operator-selected batch file, requires/forwards the research key, and chunks to 100 records/900 KiB. | Scoped replay-ingest route upserts run records. |
| `workers:acceptance` | Directly inserts one small job per worker task, including simulation, and sends SQS messages using operator AWS/Mongo credentials. | Production acceptance jobs and queue messages. |
| `load:worker-isolation` | Operator-only paired baseline/load measurement; at most two route-cap tournament and two route-cap label jobs, four gameplay clients, and 25 HTTP moves/client plus 42 fixed browser moves. External targets require explicit opt-in and are pinned to production. | Temporary production acceptance jobs, queue messages, and game sessions; controlled job/artifact records are removed after the run. |

## Security boundary update

The four inventory findings are closed by the third Phase 5 slice. Scoped key
grants remain separate from quota identity; replay ingest is an authenticated,
bounded operator import; new jobs are principal-bound with a 24-hour legacy
compatibility window; and tournament now has body plus aggregate-compute caps.
Relevant operator clients forward the research key, challenge token, and job
polling credentials. See
`v2-phase5-research-authorization-caps-2026-10-22.md` for the decision record.

## Drift coverage

`workload-entrypoint-inventory.test.ts` locks the reviewed 24-entry surface,
verifies every source and HTTP/worker export or package command, checks command
aliases, and preserves explicit tests for the security boundaries above plus
the controlled worker-isolation load envelope and acceptance thresholds.
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
