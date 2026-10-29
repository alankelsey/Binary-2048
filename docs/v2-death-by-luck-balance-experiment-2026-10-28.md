# Death by Luck balance experiment (2026-10-28)

## Decision

Do not choose a default spawn profile yet. All nine candidates are too easy for
the current 2048 target: a deterministic one-ply policy won 99.5% to 100% of
1,800 Monte Carlo runs. Adding ×4 or ×8 wildcard outcomes also makes a run
highly seed-sensitive and frequently ends it in only a few dozen moves.

This is an offline prototype result. It does not enable the mode, change the V1
ruleset, or make Death by Luck ranked.

## Method

- Candidate grid: wildcard spawn rates 50%, 65%, and 80%, crossed with
  multiplier sets `[2]`, `[2, 4]`, and `[2, 4, 8]`.
- The remaining spawn probability keeps the same mix for every candidate: 80%
  one, 14% zero, and 6% Lock-0.
- Monte Carlo cohort: the same 200 seeds (`20000` through `20199`) for every
  candidate, a 600-move cap, and a 2048 win target.
- Fixed-seed replay cohort: seeds `20000`, `20073`, and `20199` for every
  candidate.
- Policy: preview legal moves in stable left/down/right/up order and greedily
  prefer immediate score, then empty cells, then maximum tile. It has no
  look-ahead and no access to future spawns.
- Percentiles use the nearest lower observed value. Score and maximum-tile
  distributions include every outcome. `Move spread` is move p90 divided by
  move p10 and is used as a simple seed/luck sensitivity signal.

The runner is `scripts/death-by-luck-balance.ts`; the simulation and policy are
isolated in `lib/binary2048/death-by-luck-balance.ts`.

## Monte Carlo results

All distribution cells are p10 / p50 / p90.

| Wildcard | Multipliers | Win | Board-fill loss | Capped | Moves | Score | Max tile | Move spread |
| ---: | :--- | ---: | ---: | ---: | :--- | :--- | :--- | ---: |
| 50% | ×2 | 99.5% | 0.5% | 0% | 53 / 106 / 168 | 4,744 / 6,681 / 9,712 | 2,048 / 2,048 / 2,048 | 3.17× |
| 50% | ×2, ×4 | 100% | 0% | 0% | 21 / 46 / 81 | 3,274 / 5,489 / 7,840 | 2,048 / 2,048 / 4,096 | 3.86× |
| 50% | ×2, ×4, ×8 | 100% | 0% | 0% | 12 / 28 / 52 | 2,780 / 5,238 / 10,100 | 2,048 / 2,048 / 8,192 | 4.33× |
| 65% | ×2 | 100% | 0% | 0% | 20 / 60 / 111 | 4,181 / 5,795 / 9,128 | 2,048 / 2,048 / 2,048 | 5.55× |
| 65% | ×2, ×4 | 100% | 0% | 0% | 12 / 27 / 52 | 3,126 / 4,504 / 7,131 | 2,048 / 2,048 / 4,096 | 4.33× |
| 65% | ×2, ×4, ×8 | 100% | 0% | 0% | 9 / 17 / 34 | 2,634 / 4,932 / 9,966 | 2,048 / 2,048 / 8,192 | 3.78× |
| 80% | ×2 | 100% | 0% | 0% | 13 / 30 / 64 | 4,096 / 4,668 / 7,622 | 2,048 / 2,048 / 2,048 | 4.92× |
| 80% | ×2, ×4 | 100% | 0% | 0% | 9 / 17 / 34 | 2,904 / 4,038 / 6,376 | 2,048 / 2,048 / 4,096 | 3.78× |
| 80% | ×2, ×4, ×8 | 100% | 0% | 0% | 7 / 13 / 22 | 2,610 / 4,578 / 9,628 | 2,048 / 2,048 / 8,192 | 3.14× |

The sole board-fill loss was the 50%/×2 candidate at move 171. For that
candidate, winning runs had move p10 / p50 / p90 of 53 / 106 / 168. Every
other candidate had no loss or capped run, so its move distribution is also
its moves-to-win distribution.

## Fixed-seed replay

Every fixed-seed run won. Cells show moves to win for seeds 20000 / 20073 /
20199.

| Wildcard | Multipliers | Fixed-seed moves |
| ---: | :--- | :--- |
| 50% | ×2 | 123 / 97 / 90 |
| 50% | ×2, ×4 | 77 / 27 / 29 |
| 50% | ×2, ×4, ×8 | 46 / 16 / 18 |
| 65% | ×2 | 48 / 48 / 54 |
| 65% | ×2, ×4 | 25 / 21 / 88 |
| 65% | ×2, ×4, ×8 | 10 / 18 / 18 |
| 80% | ×2 | 38 / 22 / 39 |
| 80% | ×2, ×4 | 33 / 18 / 19 |
| 80% | ×2, ×4, ×8 | 10 / 14 / 13 |

The fixed seeds reproduce exactly on rerun. They also illustrate the main luck
problem: for example, 65% with ×2/×4 takes 21 moves on one seed and 88 on
another despite identical policy and initial rules.

## Interpretation and next gate

The experiment rejects the complete candidate grid. A 50% wildcard rate with
only ×2 is the least extreme candidate, but a 99.5% win rate still provides no
meaningful loss pressure. Broader multiplier distributions trade even shorter
runs for large score and max-tile tails; their p90 maximum reaches 4,096 or
8,192 even though play stops as soon as 2,048 is reached.

Before selecting defaults, the next experiment should test at least one
additional balancing lever (a higher target, lower wildcard rates, bounded
wildcard uses, or a cost/risk attached to multiplication) and compare more
than one deterministic policy. Human play testing remains necessary because
this greedy policy estimates mechanical difficulty, not whether the volatility
is entertaining or understandable.

## Verification

- `npm run test:unit:concise -- lib/binary2048/death-by-luck-balance.test.ts`
  — 2 tests passed.
- `npm run typecheck` — passed.
- ESLint on the runner, simulator, and regression test — passed.
- Production isolation: the runner imports prototype-only Death by Luck
  modules and is not referenced by app routes or the V1 engine.
