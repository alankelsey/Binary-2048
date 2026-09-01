# Hugging Face Model Benchmark

- Date: 2026-08-31
- Model: `Qwen/Qwen3.5-397B-A17B`
- Provider: DeepInfra through Hugging Face Inference Providers
- Seed: `100`
- Maximum moves: `25`
- Ruleset: `binary2048-v1` default configuration
- Settings: thinking disabled, temperature 0, JSON-schema action output

## Results

| Policy | Score | Moves | Max Tile | Fallbacks | Avg Latency | p95 Latency |
|---|---:|---:|---:|---:|---:|---:|
| Qwen3.5 397B-A17B | 80 | 25 | 16 | 0 | 686 ms | 1,377 ms |
| Local Qwen3 8B, engine candidates | 78 | 25 | 16 | 0 | 22,754 ms | 29,543 ms |
| Rollout | 59 | 25 | 16 | not applicable | approximately 22 ms | — |

The hosted model used 10,371 prompt tokens and 150 output tokens (10,521
total). At the observed DeepInfra rates of $0.45 per million input tokens and
$3.00 per million output tokens, the estimated inference cost was $0.00511695.

On this single seed, the hosted model scored 2 points higher than local Qwen
and 21 points higher than rollout. It was about 33 times faster than local Qwen,
but about 31 times slower than rollout. This sample is too small to establish a
quality advantage; additional fixed seeds are required.

## Reproduction

Configure `HF_TOKEN` in `.env.local`, run the app locally, then execute:

```bash
SEED=100 MAX_MOVES=25 npm run hf:bot
```

The adapter defaults to a conservative $0.01 preflight and measured-cost cap.
