# Binary-2048 Model Decision Traces

This directory contains the first trace-complete, multi-model research export.
Every step includes the encoded board, legal-action mask, all engine-evaluated
candidate boards, selected action, outcome, tokens, fallback status, and model
latency. See `manifest.json` for row counts and SHA-256 checksums.

## Trace regeneration cohort

- Experiment: `trace-regeneration-2026-09`
- Seeds: `100`–`104`
- Moves per model/seed: `25`
- Candidate boards: supplied for every legal action
- Temperature: `0`
- Structured output: JSON-schema action

| Model | Runs | Step rows | Avg score | Avg model latency | Input tokens | Output tokens | Fallbacks | Conservative cost |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Qwen3.5-397B-A17B / DeepInfra | 5 | 125 | 105.0 | 736 ms | 52,009 | 750 | 0 | $0.89 |
| GPT-OSS-120B / Novita | 5 | 125 | 83.4 | 5,330 ms | 58,931 | 65,820 | 0 | $0.89 |
| Qwen3-8B / local Ollama | 5 | 125 | 157.2 | 5,238 ms | 50,902 | 750 | 0 | $0.00 |

The Ollama aggregate latency includes seed 100 on an Intel build under
translation (22,400 ms average). After switching to the native Apple Silicon
runtime, seeds 101–104 averaged 947 ms/model decision. Keep this provenance
when analyzing latency; game scores remain usable across all five local runs.

The JSONL files are canonical. Parquet files are derived convenience tables;
nested boards and candidates are retained in JSON-typed columns. The 20 older
schema-v1 runs appear only in `run_metrics` because their decision traces were
not captured and must not be treated as training steps.

`rollout_steps` is currently empty. Same-seed rollout summary results are stored
on each run-metrics record, while the older rollout training corpus remains in
`artifacts/training-archive-20260816`.
