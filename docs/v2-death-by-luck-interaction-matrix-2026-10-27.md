# V2 Death by Luck interaction matrix

Date: 2026-10-27 America/Boise

Status: prototype interaction gate complete; not approved for production.

## Candidate interaction decisions

- Wildcard-to-wildcard pairs never combine, whether their multipliers are equal
  or unequal.
- Wildcard-plus-number multiplies in either order and scores the resulting
  number. Equal numbers merge and score normally.
- Zero-plus-number preserves and scores the number. Zero-plus-zero and
  zero-plus-wildcard annihilate with no score.
- Lock-0 deliberately retains V1 behavior in this mode to avoid combining two
  experimental mechanics: it slides, blocks on even global turns, and acts as
  zero on odd global turns. Anchored locks remain a separate V2 ruleset.

## Integrated prototype

A versioned game wrapper uses the explicit Death by Luck definition for move
resolution, deterministic wildcard-heavy spawning, score/turn state, undo,
win and game-over detection, replay export/import, direct recovery, and shared
simulation/action masks. Replay and recovery reject other ruleset identities.
The mode's eligibility function always rejects ranked leaderboard submission.

## Coverage

Tests cover zero with numbers, zeros, and wildcards; even/odd Lock-0 behavior;
equal and unequal wildcard blocking; multiplication scoring; fast-win
detection; wildcard-fill loss; undo; replay; recovery; action-mask agreement;
seeded spawning; and leaderboard exclusion.

## Isolation

No production route, engine, simulation, replay, recovery, tutorial, or
leaderboard module imports the prototype. Promotion remains blocked on balance
evidence and the final engine/schema/browser acceptance decision.

## Verification

- Focused Death by Luck suites pass.
- TypeScript, focused ESLint, spelling, diff validation, and production-import
  isolation pass.
