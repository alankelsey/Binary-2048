# V2 Phase 3 coalesced resume writes — 2026-10-17

Status: complete.

The game now updates the durable compact-recovery record in memory during move
processing, then writes it after a 200 ms latest-only delay. Input capture,
local engine evaluation, local paint, request dispatch, and acknowledgement
reconciliation no longer synchronously call `localStorage`.

Each pending record has a monotonic revision. A timer may flush only the latest
revision; a stale timer is ignored. Starting a new game invalidates queued work
before removing the old record, so an older callback cannot recreate it.
`visibilitychange` when hidden, `pagehide`, and component cleanup synchronously
flush the current newest revision. They do not manufacture a newer payload or
overwrite a record with an older revision.

The 24-command acknowledged tail and 9-command pending tail limits remain
unchanged. Signed checkpoint validation, FIFO recovery, duplicate prevention,
and ranked integrity remain server-authoritative.

## Validation

- Queue unit coverage proves coalescing, stale callback rejection, and clear
  invalidation.
- Focused storage/performance unit tests: 3 suites, 16 tests passed.
- Browser suite: 68 passed, 1 diagnostics-only skip, including deferred
  durable persistence, missing-session recovery, failed recovery, and export
  flush boundaries.
- Unit suite: 167 suites, 602 tests passed.
- TypeScript and optimized production compilation: passed.

## Release verification

- Runtime commit `1ffd0c2` deployed successfully in Amplify job 403.
- Production smoke checks against `https://www.binary2048.com` passed.
