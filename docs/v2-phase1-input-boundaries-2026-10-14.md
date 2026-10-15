# V2 Phase 1 queue and touch boundaries

Date: 2026-10-14

Status: queue-capacity behavior is implemented, deployed, and production-smoke
accepted. The touch state machine is implemented and synthetically accepted;
physical Pixel cancellation and multi-touch recovery remain open.

## Queue-capacity contract

Normal gameplay permits one executing move and at most eight pending moves in
FIFO order. When eight are waiting, the newest keyboard, recognized swipe, or
onscreen-control input is not queued. Controls remain enabled so every source
uses the same classification path. The rejected trace retains source,
`queue_full`, and capture/drop depth eight; earlier commands are never replaced,
coalesced, or replayed.

The full event displays `Move not queued: 8 moves are already waiting.` for 2.8
seconds in a stable-height status line near the board. The persistent
`role="status"`, polite, atomic live region is outside the busy game card, so an
active request does not defer the announcement. A repeated rejection refreshes
the visual interval without changing queue ordering or telemetry. The feedback
timer is cleared on component teardown.

## Touch-state contract

Touch recognition now uses three explicit states:

- `idle` may begin tracking only when exactly one finger is active;
- `tracking` stores that finger's identifier and origin; and
- `blocked` rejects the whole gesture after any multi-touch, mismatched ending,
  or malformed sequence until all fingers lift.

A valid end must contain exactly the tracked finger as the sole changed touch
and leave no active touches. The state settles before threshold/direction work,
so short swipes and empty endings cannot leave a stale origin. `touchcancel`
clears to idle when no fingers remain and otherwise blocks until the remaining
fingers lift. A second finger appearing during start or move invalidates the
gesture. Cancelled, blocked, short, and orphaned sequences are not directional
inputs and therefore create neither move requests nor completed/dropped move
records.

## Local acceptance

- Unit coverage proves identity matching, valid and short endings, cancellation,
  a mismatched finger, initial multi-touch, a second finger joining, blocked
  lift ordering, empty endings, and return to idle.
- Focused Chromium coverage proves queue feedback semantics and unchanged
  saturation telemetry while every D-pad control stays enabled.
- A separate Chromium test sends valid swipes between cancellation, stale-end,
  mismatched-finger, initial-multi-touch, and second-finger sequences. Only the
  six valid single-finger swipes create requests and completed records; invalid
  sequences create none, and each fresh swipe recovers normally.
- The focused browser run passed all five queue/touch tests. The complete local
  UI suite passed 55 tests with one expected diagnostics skip.
- The complete unit suite passed 161 suites and 555 tests. TypeScript validation
  passed.
- The production bundle compiled, type-checked, and generated all 62 static
  pages. The local wrapper then reached the known environment-only smoke blocker:
  `/api/auth/bridge-token` returned 503 because the production bridge secret is
  intentionally unavailable locally.
- Runtime commit `d4929cadb1f34b2d994950a195e5cf752369096a` deployed successfully
  through Amplify job 384. The post-deploy production verification passed.

Synthetic `TouchEvent` coverage proves application transitions, not Android or
Chrome event generation. The physical Pixel protocol now includes cancellation,
interruption, both multi-touch lift orders, and fresh-swipe recovery. Keep the
touch roadmap parent open until that device evidence passes.
