# Hugging Face Model Benchmark

- Date: 2026-09-03
- Model: `Qwen/Qwen3.5-397B-A17B`
- Provider: DeepInfra through Hugging Face Inference Providers
- Seeds: `100`–`105`
- Maximum moves: `25`
- Ruleset: `binary2048-v1` default configuration
- Settings: thinking disabled, temperature 0, JSON-schema action output

## Results

| Seed | Hosted Score | Hosted Max Tile | Rollout Score | Rollout Max Tile | Hosted Avg Latency |
|---:|---:|---:|---:|---:|---:|
| 100 | 80 | 16 | 59 | 16 | 686 ms |
| 101 | 75 | 16 | 136 | 64 | 678 ms |
| 102 | 211 | 128 | 9,376 | 8,192 | 621 ms |
| 103 | 80 | 16 | 170 | 64 | 631 ms |
| 104 | 67 | 8 | 172 | 32 | 723 ms |
| 105 | 67 | 8 | 237 | 64 | 708 ms |

| Aggregate | Hosted Qwen3.5 | Rollout |
|---|---:|---:|
| Average score | 96.7 | 1,691.7 |
| Median score | 77.5 | 171 |
| Average max tile | 32 | 1,405.3 |
| Median max tile | 16 | 64 |
| Seeds won head-to-head | 1 / 6 | 5 / 6 |
| Invalid-output fallbacks | 0 / 150 | not applicable |
| Average decision latency | 675 ms | approximately 22 ms |

Across six seeds, the hosted model used 62,176 prompt tokens and 900 output
tokens (63,076 total). The published DeepInfra token rates implied $0.03067920,
but dashboard-observed billing from the initial seed showed about $0.00714 per
request. At that observed rate, all six 25-move runs are estimated at $1.07;
the five runs added on September 3 are estimated at $0.89.

For the initial seed-100 run, the published token rates implied $0.00511695,
but the Hugging Face billing dashboard subsequently showed $0.25 accrued for
all 35 successful calls made during setup and benchmarking. Those calls were
the two one-move smoke tests, an eight-move partial run, and this 25-move run.
The observed average was therefore about $0.00714 per request, allocating
approximately $0.18 of actual cost to the 25-move benchmark. The dashboard is
authoritative; the reason for the discrepancy with the listed token rates is
not exposed in the inference response.

Across six seeds, rollout beat the hosted model five times and had substantially
higher median score and max tile. Seed 102 contains a wildcard-assisted rollout
win, but removing that outlier still leaves rollout with a 154.8 average score
versus 73.8 for hosted Qwen on the other five seeds. The hosted model is useful
as a prompt/model baseline, but it does not justify replacing rollout.

A future experiment with a stronger reasoning model is approval-gated because
its output-token use and cost can be much higher. Do not launch it without
explicit approval of the model, move count, seed count, and estimated budget.

## Reproduction

Configure `HF_TOKEN` in `.env.local`, run the app locally, then execute:

```bash
SEED=100 MAX_MOVES=25 npm run hf:bot
```

Hugging Face obtains the final provider-reported charge asynchronously, after
the inference response. A client therefore cannot enforce a real-time dollar
cap from response token counts. The adapter defaults to a $5.00 preflight limit
using the observed $0.00714 per-request cost; override
`HF_MAX_ESTIMATED_COST_USD` explicitly to authorize a larger run.
