# V1 shared infrastructure acceptance

Date: 2026-10-02

## Accepted production baseline

- Application commit: `330620c` (`complete approved v1 shared infrastructure`)
- Amplify job: `370`, status `SUCCEED`
- GitHub CI and Amplify Deploy Watch: passed
- Worker stack: `binary2048-v1-workers`, status `CREATE_COMPLETE`
- Architecture constraints preserved: no NAT, provisioned concurrency,
  always-on worker, second paid database, or paid analytics

## Dedicated workers

Tournament and training generation now use separate encrypted SQS queues,
dead-letter queues, and on-demand Lambda functions. Each queue is limited to two
concurrent worker invocations. Jobs allow two 60-second attempts at 2 GB, expire
from the result store after 24 hours, and share a conservative admission budget
of 250 jobs per UTC month. The application retains its endpoint rate limits and
cost caps before admitting a job.

AWS initially rejected function-level reserved concurrency because it would
reduce the account's unreserved concurrency below the required minimum. That
stack rolled back cleanly. The accepted stack uses SQS event-source maximum
concurrency instead and has no reserved or provisioned capacity.

Acceptance generated one minimal tournament, replay-training, and label-training
job directly through the queues. All three completed on their first attempt.
The deployed public tournament API then returned `202`, its opaque job endpoint
reached `complete`, and the result contained one run.

## Inventory and sessions

Inventory balances, ledger entries, and payment-reference receipts use the
existing Atlas database. Multi-document transactions keep balance, ledger, and
grant-once records together. Deleted accounts retain only the unlinkable
payment digest needed to prevent an old signed webhook from granting again.
Paid purchases remain disabled pending their separate product decision.

Session reads now await shared Mongo hydration. Writes use revisions so
competing requests cannot silently overwrite each other, and session documents
expire after seven days. Production has `BINARY2048_SESSION_STORE=mongo`.

Isolated Atlas acceptance passed concurrent inventory consumption, duplicate
payment delivery, cold session hydration through a second adapter, stale writer
rejection, durable session deletion, shared ops reads, and deleted-payment
replay rejection. The deployed inventory endpoint persisted a test grant and
returned its ledger entry; the test records were removed. Production browser
acceptance also passed stale-session recovery and ordered rapid input.

## Shared ops data and console

League configuration, model registry data, and fleet telemetry now use shared
Atlas state. Selected route metrics are emitted into the existing Amplify log
group and aggregated every 15 minutes by an on-demand 256 MB Lambda. Each run
scans at most 20 pages over the previous 24 hours, waits two minutes for log
delivery, deduplicates event IDs, and publishes completeness, freshness, and
watermark fields. The protected telemetry endpoint reported shared, complete,
fresh data after an explicit aggregation. Empty activity is represented as an
empty route set rather than fabricated traffic.

The responsive `/ops` page is implemented and remains server-authorized and
read-only. It shows storage scope, data age, incomplete/stale states, fleet
activity, league configuration, model registry, and leaderboard status. Unit
rendering verifies ordinary signed-in users are denied before data loads and
the accessible headings/table/status states render for an operator. A named
operator subject has not yet been configured, so production browser access to
the console correctly remains fail-closed. This is the sole remaining V1 ops
console acceptance item.

## Verification

- Unit: 160 suites / 541 tests passed
- Type generation and TypeScript checking passed
- Production build and build smoke passed with Node 22
- Local browser: 52 passed, 1 debug-only test skipped
- Production browser: 9/9 passed
- Production smoke and synthetic gameplay passed
- Production auth/session endpoint release check passed
- Production storage probe passed, including Mongo leaderboard round trip
- Protected storage status reported sessions, inventory, ops, leaderboard, and
  rate limits as `mongo` / `shared`
- Protected league, model, telemetry, and leaderboard ops APIs reported shared scope

The ignored OAuth storage state had expired, so the non-destructive authenticated
browser suite could not rerun: its first identity assertion found no active
user, and dependent cases did not run. This does not indicate a regression in
the cutover; the public auth/session release check and production browser auth
checks passed. Refresh the real OAuth state before the next authenticated
acceptance run. No cookie, identity, token, or credential was logged or committed.
