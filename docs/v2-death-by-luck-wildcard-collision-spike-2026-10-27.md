# V2 Death by Luck wildcard-collision spike

Date: 2026-10-27 America/Boise

Status: collision prototype gate complete; not approved for production.

## Candidate rule

- Wildcard-to-wildcard collisions never combine in Death by Luck, including
  equal multipliers. Both wildcard tiles remain in their movement order.
- Wildcard-plus-number and number-plus-wildcard collisions still multiply the
  number by the wildcard multiplier and score the resulting number value.
- Normal one-merge-per-tile ordering remains. For example, in `W2 W4 8`, W2
  remains blocked while W4 combines with 8 to produce 32.
- The resolver requires a valid explicit `death-by-luck` definition. A high
  wildcard probability or a classic-mode configuration cannot invoke it.

## Prototype boundary

The pure line/grid resolver does not spawn, advance turns, determine terminal
state, serialize replay, or alter the production engine. Zero and Lock-0
interaction decisions remain in the next plan gate.

## Verification

- Tests cover equal and unequal wildcard pairs, multiplication in both orders,
  three-tile ordering, grid movement, scoring, source immutability, and explicit
  mode enforcement.
- TypeScript, focused ESLint, spelling, diff validation, and production-import
  isolation pass.
