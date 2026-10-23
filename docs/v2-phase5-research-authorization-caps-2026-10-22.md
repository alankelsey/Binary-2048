# V2 Phase 5 scoped research authorization and hard caps — 2026-10-22

## Scope and replay-ingest contract

This slice closes only the third Phase 5 item. Before choosing authorization,
the shipped replay-ingest flow was traced from `replay:ingest:worker` to
`POST /api/replay/ingest`. It is an operator-selected bulk import of canonical
run records, not a browser or anonymous telemetry flow. The route therefore
now requires the dedicated `replay:ingest` scope (or research/admin role), and
the worker requires and forwards `BINARY2048_API_KEY`. It splits input into at
most 100 records and 900 KiB per request so the existing operator workflow fits
under the server's 100-record and 1 MiB limits.

## Authorization model

The existing bot-key registry remains an identity and quota mechanism only.
`BINARY2048_BOT_API_KEY_HASHES` resolves a non-secret key id; it grants no
operation. `BINARY2048_BOT_API_KEY_SCOPES` separately maps that id to exact
scopes. This prevents the previous optional-key behavior from silently turning
every quota key into a research credential.

| Operation | Required scope | Other accepted authority |
| --- | --- | --- |
| `POST /api/simulate` | `simulation:run` | configured research subject or admin |
| `POST /api/bots/tournament` | `tournament:run` | configured research subject or admin |
| `GET /api/training/replays` | `training:read` | configured research subject or admin |
| `GET /api/training/labels` | `training:read` | configured research subject or admin |
| `POST /api/replay/ingest` | `replay:ingest` | configured research subject or admin |
| `GET /api/jobs/{id}` | `jobs:read` plus owner match | admin may inspect any job |

Verified auth-bridge subjects in `BINARY2048_RESEARCH_SUBJECTS` receive the
research role. Existing constant-time admin service-token and verified
admin-subject authority remains a deliberate override. Missing/invalid
credentials return 401; a valid API key without the required grant returns
403. The OpenAPI explorer publishes these exact scopes and alternatives.

Tournament, benchmark, rollout, challenge, Ollama-comparison, hosted-model
comparison, and replay-ingest clients now forward `BINARY2048_API_KEY` and the
optional `BINARY2048_CHALLENGE_TOKEN`. Queued-job polling reuses the same
headers. The key-generation command emits separate hash and scope entries.

## Job ownership and compatibility

New tournament and training jobs persist the submitting principal. Status
lookups require `jobs:read` and return 404 for a different non-admin principal,
so the random 256-bit id is no longer the sole capability. Admin authority may
inspect any job.

Jobs created before this deployment have no owner field. They retain the old
opaque-id behavior only for their existing maximum 24-hour TTL. This bounded
compatibility window avoids stranding an in-flight operator job without
preserving capability-only access for newly submitted work.

## Hard limits

| Boundary | Enforced cap |
| --- | --- |
| Simulation | 60 requests/5 minutes, 128 KiB, 2,000 moves |
| Tournament | 10 requests/5 minutes, 128 KiB, 100 seeds, 2,000 moves/run, 25,000 aggregate decisions, 2,500 trace decisions |
| Training replays | shared 20 requests/5 minutes, 100 rows |
| Training labels | shared 20 requests/5 minutes, 500 rows |
| Replay ingest | 10 requests/5 minutes, 1 MiB, 100 records |
| Job polling | 120 requests/5 minutes, client interval 2 seconds and deadline 12 minutes |
| Queued jobs | 25 jobs/principal/day, 250 jobs/month globally, 128 KiB serialized task, two attempts, 24-hour TTL |
| Worker execution | existing 2 GB/60-second Lambda and event-source concurrency two per queue |

The tournament aggregate-decision limit closes the multiplicative gap where
individually legal seed, bot, and move values could previously admit 800,000
decisions. Shared Mongo counters are used for all scoped-route quotas when the
deployed rate-limit store is Mongo; memory remains the documented fallback.

## Contract and drift coverage

The machine inventory is now version 2 and records the scope/cap boundary.
Drift coverage locks the separate identity/scope configuration, replay caps,
job polling quota, owner check, and route authorization calls. Route tests cover
missing credentials, insufficient scopes, replay record caps, tournament body
and aggregate-compute caps, admin override, owner hiding, and the bounded
ownerless-job compatibility path.

## Validation and delivery measurement

Focused authorization, route, worker, inventory, and OpenAPI validation passed
at 9 suites / 63 tests. Type generation and TypeScript checking passed. The
full unit suite passed at 174 suites / 663 tests. The full browser suite passed
at 77 tests with two expected skips after the sandbox/browser prerequisites and
one stale API-explorer assertion were corrected. The optimized production
compile passed with the existing lint warnings; the already-built smoke harness
passed with host-level port permission.

Discovery and validation remained in scoped batches below 5,000 returned
tokens. One search reported 5,074 pre-truncation tokens and one combined route
read reported 6,253 pre-truncation tokens; both returned below the cap, but the
pre-truncation measurements are retained conservatively. The focused ladder ran
several times while authorization fixtures and the changed OpenAPI expectation
were stabilized. The full unit gate ran once. The browser command ran four
times: sandbox Chromium denial, missing dev server, one stale documentation
assertion after 76 passes, then 77 passes. Production compilation ran three times:
the first smoke lacked its build-time disposable auth environment; the second
compile succeeded but the sandbox denied its port bind, and the already-built
smoke then passed outside the sandbox. A final security review corrected one
budget-error label, so the affected 4 suites / 21 tests, TypeScript, and the
exact final optimized artifact plus smoke passed once more at host level. The measured 35% delivery-efficiency
comparison remains open; no product dependency was missed, but the repeated
environment and assertion work does not yet establish the target reduction.

V2 progress is 37/84 (44.0%), and whole-roadmap progress is 347/374 (93%).

## Production acceptance

The existing `botvsbot-primary` quota identity received the explicitly approved
`simulation:run`, `tournament:run`, `training:read`, `replay:ingest`, and
`jobs:read` grants in the separate Amplify scope registry. The configurator
preserved unrelated variables, shared Mongo rate limiting, and SQS worker mode;
no credential value or hash was printed.

Runtime commit `8f3776092a9cf31ee58d892afdffdd419665c85d` deployed
successfully in Amplify job 429. The watcher enforced the full commit id and
reported success after 184 seconds. Production acceptance then verified:

- anonymous simulation is denied with 401;
- admin-authorized simulation succeeds with the expected ruleset;
- anonymous polling of a valid new job id is denied with 401;
- a minimal authorized tournament job completes through authenticated polling;
- OpenAPI publishes `replay:ingest` and `jobs:read`; and
- the standard production gameplay smoke passes.
