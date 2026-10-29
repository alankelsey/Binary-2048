# V2 anchored Lock-0 integration matrix

Date: 2026-10-27 America/Boise

Status: prototype integration gate complete; not approved for production.

## Candidate semantics exercised

- A versioned experimental game wrapper applies the same anchored line and
  per-lock lifecycle resolver to turns, scoring, deterministic spawning, undo,
  terminal detection, replay, recovery, and simulation action masks.
- Tile movement, merging, a lock collision, or lock removal makes a swipe an
  accepted turn. A pure no-op does not advance or spawn unless the serialized
  `spawnOnNoopMove` option is enabled.
- Accepted moves spawn once when `spawnAfterAcceptedMove` is enabled. Spawning
  consumes a fixed three deterministic RNG draws: position, tile kind, and
  wildcard slot. A spawned lock starts with its own zero collision counter.
- Undo restores grid, per-lock counters, score, turn, RNG step, win/over state,
  move history, and the remaining undo stack.
- Terminal and simulation logic share the same action mask. Collision attempts
  remain legal actions even on a full board; a full board ends only when no
  direction can move, merge, collide with, or remove a lock.
- Replay serializes initial grid, configuration, and accepted directions, then
  deterministically rebuilds state. Recovery serializes current lifecycle and
  undo state directly. Both formats carry the explicit prototype version.

## Coverage

Tests cover all four directions, tiles on both sides, multiple locks, adjacent
segment merges, collision-only turns, pure no-ops, configured no-op spawning,
normal spawning, fixed RNG consumption, undo, win and game-over detection,
replay export/import, recovery, action masks, and repeatable seeded runs.

## Isolation

The wrapper is a prototype-only module. Production engine, API, replay,
recovery, bot simulation, tutorial, and ruleset identifiers remain unchanged.
Promotion still requires the explicit ruleset and migration decision in the
next plan gate.

## Verification

- Focused prototype suites pass.
- TypeScript, focused ESLint, spelling, and diff validation pass.
