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
