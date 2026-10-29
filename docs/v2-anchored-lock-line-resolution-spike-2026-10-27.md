# V2 anchored Lock-0 line-resolution spike

Date: 2026-10-27 America/Boise

Status: first prototype gate complete; not approved for production.

## Prototype boundary

- A pure experimental resolver keeps every Lock-0 at its existing board
  coordinate for the active swipe.
- Each lock acts like a board edge. The cells before and after it become
  independent line segments, and ordinary number, zero, and wildcard movement
  and merging occurs only within a segment.
- Direction handling orients rows and columns toward the swipe, resolves the
  segments, and maps them back without changing lock coordinates.
- The prototype is not called by the production engine, game API, simulation,
  replay, recovery, tutorial, or UI. The shipped V1 ruleset remains unchanged.

## Deferred gates

This slice intentionally does not choose lifecycle/removal, collision events,
turn or spawn semantics, win/game-over detection, action masks, replay
versioning, or migration. Those remain explicit unchecked items in the plan.

## Verification

- Deterministic unit tests cover left, right, up, and down movement.
- Tests prove merging on both sides of one lock, lock-coordinate stability,
  board-edge partitioning, adjacency stops, score totals, and input
  immutability.
- TypeScript, focused ESLint, spelling, and diff validation pass.
