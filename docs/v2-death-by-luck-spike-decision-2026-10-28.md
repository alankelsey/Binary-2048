# Death by Luck spike decision (2026-10-28)

## Decision

Do not ship Death by Luck. Retain `binary2048-v2-death-by-luck` as an isolated,
explicitly unranked prototype and do not add it to production game-mode
selection, tutorial, help, recovery migration, or leaderboards.

The interaction model is deterministic and technically viable, but the first
balance gate rejected every candidate. A one-ply deterministic policy won
99.5% to 100% of 1,800 runs, and ×4/×8 outcomes often shortened games to only
a few dozen moves. No default spawn distribution was chosen.

## Deterministic engine and schema regression gate

The checked-in prototype regressions cover:

- explicit mode, schema version, ruleset ID, and unranked identity;
- rejection of implicit, ranked, mismatched-ruleset, and insufficiently
  wildcard-heavy definitions;
- non-combining wildcard/wildcard collisions and wildcard/number scoring;
- zero and Lock-0 interactions, all directions, action masks, terminal state,
  undo, seeded spawning, replay, and recovery;
- deterministic fixed-seed balance runs and separate win/loss/move, score,
  maximum-tile, and seed-sensitivity summaries.

These are prototype contracts, not permission to deserialize the ruleset into
the V1 engine. There is no replay migration from or to `binary2048-v1`.

## Browser, tutorial, and help acceptance criteria

If a later balance experiment produces an approved default, shipping still
requires all of the following:

1. The New Game UI names the mode, labels it unranked before start, and never
   infers it from a wildcard percentage.
2. Browser coverage verifies mouse, keyboard, touch, mobile layout, deterministic
   seeded play, win/game-over, undo, export/import, recovery, and the visible
   unranked marker.
3. The tutorial demonstrates that two wildcards block each other while a
   wildcard and number multiply, including equal and unequal multipliers, zero,
   and Lock-0 examples. Instructions must not imply ordinary V1 wildcard rules.
4. Basic and advanced help explain the volatility, scoring, terminal behavior,
   replay compatibility boundary, and leaderboard exclusion.
5. Screen-reader announcements name wildcard multipliers and blocked collisions;
   reduced-motion presentation communicates outcomes without relying on motion.
6. API and browser tests prove that imported or hand-edited mode identity cannot
   enter ranked submission paths.

Until those criteria and a second balance gate pass, absence from production UI
is the expected browser behavior.

## Verification

- `death-by-luck-prototype.test.ts`: explicit schema and identity.
- `death-by-luck-engine-prototype.test.ts`: line/grid collision rules.
- `death-by-luck-game-prototype.test.ts`: integrated deterministic lifecycle.
- `death-by-luck-balance.test.ts`: fixed-seed and Monte Carlo reproducibility.
- Balance evidence: [Death by Luck balance experiment](./v2-death-by-luck-balance-experiment-2026-10-28.md).
