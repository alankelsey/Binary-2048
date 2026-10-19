# V2 Phase 4 diagnostic ring buffer — 2026-10-19

Status: complete for bounded storage and closed-panel formatting. Phase 4
remains open.

## Runtime contract

Diagnostics are stored in a ref-backed ring with a fixed capacity of 250. A
push overwrites the oldest entry only after capacity is reached, snapshots are
returned in chronological order, and clear resets the visible history without
resetting the monotonic event sequence.

When the support log is closed, recording an entry performs no React state
update, array copy, or full-log formatting. Opening the panel snapshots and
formats the current ring. New entries refresh the view while it remains open.
Copy Log independently snapshots and formats at click time, so copying while
closed includes the newest retained entries. Clear Log empties the ring and
refreshes an open panel immediately.

The compile-time support-log flag remains disabled by default. Existing
redaction, console-error capture, recovery diagnostics, state-regression
signals, and copy behavior are unchanged.

## Acceptance evidence

- Unit coverage proves fixed capacity, chronological rollover, clear behavior,
  invalid-capacity rejection, formatting, and secret redaction.
- The diagnostics browser suite proves the panel starts closed, opens with
  retained entries, updates while open, copies current content, redacts a
  credential-like value, closes and reopens without loss, and clears.
- Browser mocks now recognize compact recovery and correctly retain the
  fail-closed prediction-divergence event instead of expecting a rejected move
  to enter recovery history.

## Delivery-efficiency pilot

Discovery used nine bounded commands, with no individual source read exceeding
5,000 output tokens. Focused validation used one unit run, one TypeScript run,
and three iterations of the dedicated diagnostics browser suite; the browser
iterations identified stale Phase 2/3 mock assumptions before the full matrix.
The slice is smaller than the session-compaction baseline, so it does not claim
a comparable 35% reduction. The delivery-efficiency roadmap item remains open.

## Validation

- Focused diagnostics unit suite: 5 tests passed.
- Dedicated support-log browser suite: 1 passed, 1 expected configuration skip.
- Full unit suite: 168 suites / 618 tests passed.
- Full local browser suite: 70 tests passed, 1 diagnostics-only test skipped.
- TypeScript and optimized production build smoke passed.
