# Ollama vs Rollout Benchmark

- Date: 2026-08-31
- Hardware: Apple M4 Pro, 24 GB unified memory
- Ollama: 0.33.0
- Model: `qwen3:8b` (`Q4_K_M`, 5.2 GB)
- Seeds: `100`, `101`, `102`
- Maximum moves per game: `25`
- Ruleset: `binary2048-v1` default configuration
- Qwen settings: thinking disabled, temperature 0, JSON-schema action output

## Results

| Seed | Policy | Score | Moves | Max Tile | Won | Fallbacks | Avg Decision Latency |
|---:|---|---:|---:|---:|---|---:|---:|
| 100 | Qwen3 8B | 53 | 25 | 8 | no | 0 | 6,792 ms |
| 100 | Rollout | 59 | 25 | 16 | no | 0 | — |
| 101 | Qwen3 8B | 73 | 25 | 16 | no | 0 | 10,391 ms |
| 101 | Rollout | 136 | 25 | 64 | no | 0 | — |
| 102 | Qwen3 8B | 155 | 25 | 64 | no | 0 | 10,769 ms |
| 102 | Rollout | 9,376 | 12 | 8,192 | yes | 0 | — |

Aggregate comparison:

| Metric | Qwen3 8B | Rollout |
|---|---:|---:|
| Average score | 94 | 3,190 |
| Median score | 73 | 136 |
| Average max tile | 29 | 2,757 |
| Median max tile | 16 | 64 |
| Invalid-output fallbacks | 0 / 75 | not applicable |
| Average latency per completed move | 9,317 ms | approximately 15 ms |

The rollout measurement completed 62 moves across the three games in 953 ms,
including the local HTTP request. Qwen completed 75 model decisions in
approximately 699 seconds. On this sample, rollout was about 600 times faster
per move.

## Interpretation

Qwen's structured-output reliability was good: every response selected a legal
action, so the deterministic fallback was never used. Its policy quality was
not competitive with shallow engine-native search. It showed a strong bias
toward `D`, and sustained inference slowed from roughly 6–7 seconds per move in
the first game to roughly 10–11 seconds in later games.

The seed-102 result is influenced by Binary-2048 wildcard mechanics: rollout
found a winning line and reached 8192 within the move cap. Median score and
median max tile still favor rollout without relying on that outlier.

Conclusion: keep Qwen3 8B as a zero-shot experimental baseline and prompt/model
research target. Use rollout or a trained compact policy for actual tournament,
self-play, and interactive workloads.

## Reproduction

Run the app locally, then execute each fixed-seed Qwen game:

```bash
SEED=100 MAX_MOVES=25 npm run ollama:bot
SEED=101 MAX_MOVES=25 npm run ollama:bot
SEED=102 MAX_MOVES=25 npm run ollama:bot
```

Run rollout through `POST /api/bots/tournament` with:

```json
{
  "seeds": [100, 101, 102],
  "maxMoves": 25,
  "bots": ["rollout"]
}
```

