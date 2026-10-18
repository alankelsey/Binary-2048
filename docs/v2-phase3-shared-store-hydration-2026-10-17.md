# V2 Phase 3 shared-store hydration — 2026-10-17

Status: complete.

## Boundary

A Mongo-backed session lookup that returns no record now gets a small,
awaitable hydration window before Binary 2048 returns `Game not found`. This
covers a just-persisted session becoming visible to a different runtime without
changing memory-store behavior or putting a retry in the browser.

The default window is 180 ms, polling every 20 ms. Deployment configuration
may tune both values, but the timeout is capped at 1 second and the poll delay
at 100 ms. A successful first read remains one lookup. Memory mode remains one
lookup even when the session is missing.

## Failure and compatibility behavior

The initial shared-store read and each hydration retry retain the existing
storage-error classification: unavailable storage returns the sanitized 503
response, and conflicts retain their existing 409 behavior. A true absence
after the deadline returns the existing 404 payload. No recovery payload is
trusted or imported until the authoritative shared-store window ends.

The move route passes its request abort signal to the wait. Cancellation stops
future polls and leaves the result classified as missing rather than inventing
a storage error. Normal move requests that already find their session do not
wait. The bounded wait is recorded as `session_hydration_wait` in
`Server-Timing`; it contains only duration, never session identifiers or game
content.

All central session reads use this boundary, so state, undo, export, replay,
and recovery paths share the same missing-session semantics. Compact normal
move traffic, signed checkpoint recovery, turn/hash guards, duplicate
prevention, FIFO ordering, checkpoint/tail limits, and ranked integrity remain
unchanged.

## Acceptance evidence

- Route coverage proves a first-null shared lookup can hydrate and move the
  session, including the timing projection and Mongo provenance.
- Route coverage proves a true shared-store absence exhausts the bounded window
  before returning the unchanged 404 response.
- Route coverage proves a failing hydration retry retains the sanitized 503
  response without exposing its shared-store error.
- Session coverage proves request cancellation stops further hydration polls
  without reclassifying the result as a storage failure.
- Existing browser prediction/recovery coverage confirms the browser continues
  to paint before network acknowledgement and retains its compact 404 recovery
  path; hydration is entirely server-side.

## Validation

- Full unit suite: 167 suites, 606 tests passed.
- Full local browser suite: 68 tests passed, 1 diagnostics-only test skipped.
- TypeScript and optimized production compilation: passed.

## Release verification

- Runtime commit `15ad88f` deployed successfully in Amplify job 405.
- Production smoke checks against `https://www.binary2048.com` passed.
