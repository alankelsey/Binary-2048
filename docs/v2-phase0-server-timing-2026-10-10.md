# V2 Phase 0 server timing implementation evidence

Date: 2026-10-10

Status: deployed and accepted; runtime-correlation and device sampling remain open.

## Implemented contract

The move route now returns a bounded `Server-Timing` header containing only
allowlisted phase names and nonnegative durations rounded to two decimal
places. A phase is omitted when it did not run. The current names are:

- `rate_limit_identity`
- `rate_limit_counter`
- `request_parse`
- `session_lookup`
- `recovery_verify`
- `recovery_replay`
- `recovery_import`
- `engine_move`
- `session_persist`
- `snapshot_build`
- `snapshot_sign`
- `response_encode`
- `total`

`session_persist` measures awaited writes and deletes. Recovery totals can
contain replay and persistence subspans, so component durations are not
expected to add up to `total`. Responses also set `Cache-Control: no-store`.

Detailed path attribution is kept out of the public header. The protected,
bounded operations telemetry retains at most 200 recent move records with
fixed enums for status, session path (`resident_memory`, `mongo_hydration`,
`recovery_snapshot`, `legacy_export`, `missing`, or `not_checked`), and
rate-limit backend (`memory`, `mongo`, or `memory_fallback`). It contains no
game ID, account or IP identity, state hash, move, recovery body, signature,
secret, Mongo address, or raw exception text. Shared operations logging emits
the same sanitized record when enabled.

## Local verification

The focused route tests cover:

- a successful resident-memory move and its timing stages;
- invalid input, proving unexecuted session and engine stages are omitted;
- a missing session;
- compact and legacy recovery imports;
- a signed snapshot, including snapshot signing without leaking its signature
  or secret;
- a stale-state conflict without mutation; and
- rate-limit rejection, proving no session, engine, persistence, or snapshot
  stage is reported.

The focused suites passed: 3 suites, 17 tests. The full unit suite passed: 160
suites, 542 tests. TypeScript compilation and `git diff --check` also passed.
The Next.js production compile, type validation, static generation, and route
manifest completed. Its wrapper's post-build smoke first stopped at the known
missing local `BINARY2048_AUTH_BRIDGE_SECRET`; a direct retry with a disposable
value could not bind the local test port in the workspace sandbox. Production
header preservation therefore remains part of deployment acceptance.

## Production acceptance

Amplify job `377` deployed exact commit
`c8e8985f631cf54dd78312b4432296a076dc0587` successfully. The standard
production smoke passed on its first attempt against `www.binary2048.com`.

The repeatable `ops:v2:timing-acceptance` probe keeps disposable IDs and
recovery payloads in process memory and outputs only the target host, UTC
window, status, cache policy, and allowlisted timing names and durations. The
corrected acceptance run from `20:27:20.140Z` through `20:27:22.403Z` made five
normal moves, one missing-session request, and one unsigned compact-recovery
request. All seven responses returned `Cache-Control: no-store` and a valid
`Server-Timing` header.

The five normal Mongo moves returned HTTP 200 with route totals of 30.49,
31.43, 32.13, 32.43, and 35.31 ms. Session lookup ranged from 13.39 to 16.77
ms; awaited persistence ranged from 16.08 to 17.60 ms. The missing-session
request returned HTTP 404 with the expected reduced stage set and a 34.30 ms
route total. The recovery request returned HTTP 200 with verification, replay,
import, persistence, move, snapshot, and signing stages; its total was 58.43
ms, including 25.71 ms recovery import and an aggregate 42.52 ms persistence.

A protected CloudWatch query over that narrow window returned exactly seven
sanitized `binary2048_move_timing` events:

| Count | Status | Session path | Rate-limit backend |
| ---: | ---: | --- | --- |
| 5 | 200 | `mongo_hydration` | `memory` |
| 1 | 404 | `missing` | `memory` |
| 1 | 200 | `recovery_snapshot` | `memory` |

No request or response bodies, IDs, cookies, credentials, signatures, Mongo
addresses, or raw exceptions were retained in this evidence. The compact
recovery signature was removed in memory before using a mismatched disposable
route ID, avoiding reliance on the current trusted-snapshot route-binding
behavior.

The `memory_fallback` rate-limit branch remains covered locally. Inducing it in
production would require breaking the shared Mongo counter used by verified
API keys and could weaken live enforcement or disrupt other Mongo-backed
features. Production fault injection was intentionally not performed because
there is no scoped runtime control. The browser move limiter correctly used
its configured memory backend in all seven records; this is expected behavior,
not a fallback.

## Remaining Phase 0 work

The public timings do not identify a true cold start, runtime instance,
event-loop delay, memory/GC state, or concurrent workload. A first request
after deployment is not reliable cold-start evidence. Those signals and the
Pixel, desktop Chrome, and authenticated-session measurements remain open.

The acceptance review also found three instrumentation accuracy issues for the
next slice: a Mongo lookup failure is currently caught as an invalid-recovery
HTTP 400, the missing-session route performs a second uninstrumented lookup,
and failed recovery delete/final writes can omit their persistence duration.
The production recovery baseline also confirms the existing duplicate
replay/write work; it does not yet establish that work as the cause of the
historical 2.7-second outlier.

## Earlier review findings

The review also found follow-up questions that should be proved before later
optimization: recovery payload work is not explicitly bounded at this route,
compact recovery currently performs duplicate replay/write work, and
instance-local guest rate limiting behaves differently under horizontal
scaling. These findings are not established causes of the recorded latency
outlier.
