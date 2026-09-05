# Hugging Face Hosted-Model Benchmark

- Date: 2026-09-05
- Provider: Hugging Face Inference Providers
- Ruleset: `binary2048-v1` default configuration
- Maximum moves: `25`
- Prompt input: current encoded state, legal actions, and the engine-computed
  resulting board and metrics for every legal action
- Output contract: temperature 0 and JSON-schema constrained legal action
- Approved experiment ceiling: `$10`
- Per-run telemetry ledger: [`hf-benchmark-runs.json`](./hf-benchmark-runs.json)

## Two-phase design

Phase 1 screened three new candidates on seeds `100`–`104` and reused the
existing Qwen3.5 result as the control. The two best qualified models advanced
to Phase 2 on ten additional seeds, `105`–`114`. A model qualified only if it
could reliably return a legal structured action within its output allowance.

"Non-thinking" means the provider is instructed to return the action directly.
"Reasoning-style" means the model is allowed to generate intermediate compute
tokens before its structured action. Both receive the same engine candidate
boards; the label describes inference behavior, not whether a neural model does
any computation.

## Phase 1: screening

| Candidate | Mode | Seeds completed | Avg score | Median score | Result |
|---|---|---:|---:|---:|---|
| Qwen3.5-397B-A17B (control) | non-thinking | 5 / 5 | 102.6 | 80 | advanced |
| GPT-OSS-120B | reasoning-style | 5 / 5 | 95.2 | 76 | advanced |
| DeepSeek-V4-Pro | direct structured output | 5 / 5 | 84.0 | 74 | eliminated |
| Qwen3-235B-A22B-Thinking-2507 | thinking | 0 / 5 | n/a | n/a | disqualified |

Qwen Thinking repeatedly exhausted a 512-token allowance without an action. A
2,048-token retry produced one action after 1,507 tokens and about 20.8 seconds,
but a subsequent game again exhausted the cap. Continuing would not have been a
reliable or economical policy benchmark.

## Phase 2: finalists

| Seed | Qwen3.5 score | GPT-OSS score |
|---:|---:|---:|
| 105 | 67 | 138 |
| 106 | 97 | 80 |
| 107 | 164 | 127 |
| 108 | 143 | 97 |
| 109 | 70 | 75 |
| 110 | 222 | 107 |
| 111 | 84 | 49 |
| 112 | 61 | 69 |
| 113 | 60 | 64 |
| 114 | 96 | 91 |

| Aggregate | Qwen3.5 non-thinking | GPT-OSS reasoning-style |
|---|---:|---:|
| Average score | 106.4 | 89.7 |
| Median score | 90 | 85.5 |
| Seed wins | 6 / 10 | 4 / 10 |
| Invalid-output fallbacks | 0 / 250 | 0 / 250 |
| Average decision latency | 767 ms | 3,971 ms |
| Output tokens | about 1,500 | 130,977 |

GPT-OSS used 117,966 prompt tokens and 130,977 output tokens in Phase 2. Its
listed token rates imply `$0.03864255` for those ten games, but Hugging Face
settles provider charges asynchronously and earlier dashboard billing showed a
higher effective request cost. Using the observed `$0.25 / 35` call rate as a
conservative floor, Phase 2 is estimated at `$3.57` for 500 model calls. The
whole newly executed two-phase experiment, including screening and retries, is
estimated near `$5.25`, below the approved `$10` ceiling. The billing dashboard
remains authoritative.

## Decision and roadmap status

Qwen3.5 remains the hosted-model baseline. GPT-OSS did not buy higher score with
its roughly 87-times larger output and 5.2-times higher latency. Neither hosted
model replaces the built-in rollout bot based on the earlier six-seed control,
where rollout won five seeds and had a much higher median score.

This completes the hosted multi-model portion of the reproducible seeded track
and validates cost, structured-output, fallback, and latency telemetry. It does
not complete the roadmap's dual-track evaluation item: the versioned curated
fixed-board/Bitstorm challenge corpus still needs to be implemented and reported
separately.

## Reproduction

Configure `HF_TOKEN` in `.env.local`, run the app locally, then execute:

```bash
SEED=100 MAX_MOVES=25 HF_ENABLE_THINKING=0 npm run hf:bot
```

Hugging Face obtains the final provider-reported charge asynchronously, after
the inference response. A client therefore cannot enforce a real-time dollar
cap from response token counts. The adapter defaults to a $5.00 preflight limit
using the observed $0.00714 per-request cost; override
`HF_MAX_ESTIMATED_COST_USD` explicitly to authorize a larger run. Reasoning
experiments must also set `HF_ENABLE_THINKING=1` and an intentional
`HF_MAX_OUTPUT_TOKENS` value.
