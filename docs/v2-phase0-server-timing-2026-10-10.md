# V2 Phase 0 server timing implementation evidence

Date: 2026-10-10

Status: local implementation complete; deployment and environment sampling remain open.

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

## Production acceptance still required

After deployment, capture sanitized timing names and durations for guest and
authenticated moves. Demonstrate the normal Mongo path, a recovery import, a
miss, and any intentionally induced safe fallback. Confirm that the platform
preserves `Server-Timing` and `Cache-Control`, and collect enough warm and cold
samples to begin the Phase 0 baseline. Do not capture request or response
bodies, IDs, cookies, credentials, signatures, or database details.

The review also found follow-up questions that should be proved before later
optimization: recovery payload work is not explicitly bounded at this route,
compact recovery currently performs duplicate replay/write work, and
instance-local guest rate limiting behaves differently under horizontal
scaling. These findings are not established causes of the recorded latency
outlier.
