# V2 Death by Luck explicit-mode spike

Date: 2026-10-27 America/Boise

Status: identity prototype gate complete; not approved for production.

## Identity boundary

- The candidate mode is explicitly serialized as `death-by-luck` with ruleset
  `binary2048-v2-death-by-luck` and schema version 1.
- It is structurally restricted to `sessionClass: unranked`. Ranked definitions
  fail validation rather than being silently downgraded.
- A high wildcard probability does not activate or identify this mode. Missing
  or different mode and ruleset values fail closed.

## Candidate spawn envelope

The initial prototype defaults to 70% wildcard, 20% one, 7% zero, and 3%
Lock-0 spawns with wildcard multipliers 2, 4, and 8. Definitions must retain at
least a 50% wildcard rate during this spike. These values establish an
overabundant-wildcard test envelope, not production balance defaults; the later
Monte Carlo gate must compare candidates before any selection.

## Prototype boundary

A valid definition can create deterministic engine state for experiments, but
the production game route, mode selector, leaderboard, replay, tutorial, and
help surfaces do not import the prototype. Wildcard collision behavior remains
the current engine behavior until the next isolated spike item.

## Verification

- Tests cover explicit identity, unranked enforcement, wildcard-heavy defaults,
  JSON round trips, clone isolation, ruleset mismatch, missing mode identity,
  rate validation, and deterministic seeded state creation.
- TypeScript, focused ESLint, spelling, diff validation, and production-import
  isolation pass.
