# Binary-2048 Experimental Mechanics Policy

## Scope

This document covers four experimental mechanics that have been proposed for Binary-2048:

- subtract tiles
- board flip effects
- device tilt controls
- motion safety for visually dynamic mechanics

These are not approved for ranked play. This is a design and safety spike that defines constraints before implementation.

## Subtract Tile

### Goal

Introduce a tile that reduces or cancels nearby value without making the board unreadable or purely punitive.

### Recommended Rule Shape

Preferred first model:

- subtract tile interacts only on merge/collision
- subtracts one step of value from a compatible number tile
- cannot create negative numbers
- cannot chain infinitely

Example:

- `4` hit by subtract tile becomes `2`
- `2` hit by subtract tile becomes `1`
- `1` hit by subtract tile becomes `0` or clears, depending on ruleset

### Constraints

- must remain visually distinct from zero, lock, and wildcard tiles
- must produce deterministic replay events
- must not create ambiguous resolution order
- must be sandbox-only until balance is proven

### Ranked Eligibility

Subtract tiles should be excluded from ranked-pure play by default.

## Board Flip Effects

### Goal

Add occasional whole-board transformations without making the game feel random or inaccessible.

### Candidate Effects

- horizontal mirror
- vertical mirror
- 180-degree inversion

### Constraints

- transformation must be explicit and animated predictably
- effect must be visible before the next move is required
- replay log must record exact transform type
- must be disableable in accessibility settings

### Ranked Eligibility

Board flip effects should remain out of ranked until proven readable and fair.

## Tilt Control

### Goal

Allow mobile players to use device motion as an alternative input mode.

### Recommended UX

- opt-in only
- calibration step before first use
- clear toggle in options
- visible indicator when tilt input is active

### Conflict Rules

- tilt and swipe must not compete at the same time
- activating tilt should suppress swipe until disabled, or vice versa
- keyboard and button inputs remain authoritative on desktop

### Ranked Eligibility

Tilt controls may be allowed in ranked only if input behavior is deterministic enough for fairness and testing.

For now, keep tilt experimental and non-ranked.

## Motion Safety Policy

Any of the above mechanics may introduce higher motion load.

Required safeguards:

- respect `prefers-reduced-motion`
- offer explicit “reduce board motion” setting
- replace animated flips with instant transitions in reduced-motion mode
- avoid rapid flashing, shaking, or rotation loops
- keep celebratory motion cosmetic only

## Product Recommendation

Implementation order, if pursued:

1. motion safety foundation
2. board flip sandbox prototype
3. subtract tile sandbox prototype
4. tilt control mobile experiment

## Current Decision

All four mechanics are valid exploration candidates, but they belong in sandbox or event modes first and must remain out of ranked-pure play until determinism, readability, and accessibility are proven.
