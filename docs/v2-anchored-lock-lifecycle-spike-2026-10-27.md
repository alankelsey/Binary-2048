# V2 anchored Lock-0 lifecycle spike

Date: 2026-10-27 America/Boise

Status: lifecycle prototype gate complete; not approved for production.

## Candidate lifecycle

- Lifecycle is per lock coordinate, not global turn parity. A newly created
  lock starts with zero collisions, remains after the first collision, and is
  removed after its second collision.
- A collision is a swipe toward a lock from a segment containing any movable
  tile. Number, zero, and wildcard tiles are all collision triggers in this
  candidate because the trigger describes spatial contact rather than merge
  compatibility.
- The lock remains active for the entire triggering swipe. Line resolution
  stops the incoming tile beside it first; removal happens afterward. The tile
  can enter or cross the vacated coordinate only on a subsequent swipe.
- Locks age independently. A collision in one partition does not change any
  other lock's counter.

## Prototype boundary

The pure prototype reports tile motion, grid changes, collision coordinates,
removed-lock coordinates, and per-lock counters. It deliberately does not map
those results to production turns, spawns, events, win/game-over state, replay,
or recovery. The V1 global-parity behavior remains unchanged in production.

## Verification

- A three-swipe regression proves first-collision blocking, second-collision
  post-resolution removal, and passage only on the later swipe.
- Tests cover movement away from a lock, zero and wildcard triggers, and
  independent per-coordinate counters.
- TypeScript, focused ESLint, spelling, and diff validation pass.
