# Bot Benchmark Suite

Run a repeatable benchmark against fixed seeds and publish rankings.

## Command

```bash
BASE=http://localhost:3000 BENCH_SEEDS=100,101,102,103,104 MAX_MOVES=250 npm run bot:benchmark
```

Output:

- `docs/bot-benchmark-latest.md`

## Benchmark table (seed-based)

Seed set baseline:

- `100,101,102,103,104`

Metrics:

- avg score
- avg moves
- avg max tile
- wins

Reference bots:

- `priority`
- `random`
- `alternate`
- `rollout` (Monte Carlo rollout baseline)

## Notes

- Keep the same seed list when comparing bot changes.
- Re-run after bot policy changes and commit updated benchmark output.

## Planned dual-track evaluation

Report these tracks separately; neither replaces the other:

1. **Seeded-game track:** generate the initial board and later spawns from a
   fixed seed. This samples normal gameplay while keeping each bot run exactly
   reproducible when its move sequence is unchanged.
2. **Curated-challenge track:** load an explicit, versioned initial grid and
   ruleset. Include ordinary fixed boards and Bitstorm boards designed to test
   named skills such as wildcard handling, zero annihilation, locked-zero
   routing, corner preservation, survival, and merge planning.

Each curated scenario should store a stable scenario ID, initial grid, game
configuration, skill tags, expected invariants, and scenario version. Continue
to use seeded gameplay RNG after the fixed starting grid so a scenario and move
sequence can be replayed exactly.
