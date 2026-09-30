# Binary-2048 Model Decision Traces

Release status: V1 candidate; not yet tagged  
Dataset version candidate: `1.0.0`  
Ruleset: `binary2048-v1`  
Export schema: `1`  
Generated: 2026-09-05T21:50:45.486Z

## Summary

Binary-2048 Model Decision Traces is a synthetic bot-gameplay dataset produced
through the Binary-2048 API. It is intended for reproducibility research,
policy comparison, action-selection analysis, educational examples, and data
pipeline testing. It contains no human gameplay, player records, MongoDB
records, or user identifiers.

The V1 release candidate contains reviewed Parquet data, this dataset card, a
release-specific checksum manifest, and the repository license. Canonical
JSONL and the source ledger remain reproducibility inputs in the application
repository, but they are not release payloads. Executable pickle files,
operational logs, environment data, and internal handoff documents are
explicitly excluded.

## Provenance and composition

The source ledger is `docs/hf-benchmark-runs.json`. The export was produced by
`scripts/export-model-benchmark-dataset.mjs`; canonical JSONL was generated
first and the Parquet tables were derived from it. The release audit decodes
every Parquet row and requires its embedded complete record to match the
corresponding canonical JSONL row.

| Table | Runs | Rows | Policies |
|---|---:|---:|---|
| Hosted steps | 10 | 250 | Qwen3.5-397B-A17B via DeepInfra; GPT-OSS-120B via Novita |
| Ollama steps | 5 | 125 | Qwen3-8B through local Ollama |
| Rollout steps | 5 | 112 | Local Monte Carlo rollout |
| Run metrics | 40 | 40 | 20 trace-complete runs and 20 older summary-only runs |

Trace-complete games use seeds 100-104 and a maximum of 25 moves. Rollout seed
102 reached its target after 12 moves, so that table contains 112 rather than
125 rows. Metrics also contain 20 schema-v1 summary-only runs using seeds
105-114. Those records have no decision traces and are not step-supervision
examples.

Recorded trace timestamps span 2026-09-05T19:36:10.358Z through
2026-09-05T21:50:30.769Z. Older summary-only records have no recorded
timestamp.

## Policies

- `Qwen/Qwen3.5-397B-A17B:deepinfra`: non-thinking, temperature 0, maximum 16
  output tokens.
- `openai/gpt-oss-120b:novita`: reasoning-style with thinking enabled,
  temperature 0, maximum 2,048 output tokens.
- `qwen3:8b` through local Ollama: non-thinking, temperature 0, maximum 16
  output tokens.
- Local Monte Carlo rollout: six simulations per legal action, depth 10, and
  deterministic policy RNG `mulberry32(seed XOR hashBotId)`.

Language-model policies receive the encoded board, legal-action mask, and
engine-evaluated result for each legal action. They return a schema-constrained
direction. Invalid output uses deterministic fallback priority `U, L, R, D`;
the trace-complete cohort recorded no fallbacks.

## Game and RNG contract

Gameplay uses a counter-based deterministic PRNG keyed by `seed` and
`rngStep`. A seed and identical action sequence reproduce initial placement and
later spawns. Policies sharing a seed can diverge because their actions change
the board. The rollout policy uses its separate deterministic Mulberry32 stream
for simulations.

All trace-complete runs use a 4×4 board and these spawn probabilities:

- zero: 0.15
- numeric one: 0.72
- wildcard: 0.10
- locked zero: 0.03

## Schema

Step tables include run/experiment metadata, seed, model configuration, turn,
state hashes, encoded states, legal actions, action mask, engine-evaluated
candidate boards, selected action, fallback status, latency, token counts,
result state, score, reward, terminal status, and spawn result.

Nested structures are JSON-encoded in Parquet columns. Each step table also
contains the complete canonical record in `step_json`; the metrics table uses
`record_json`.

## Reproduction recipe

The exact historical shell transcript was not retained. The following is a
reconstructed recipe from the checked-in runners and recorded configuration;
it must not be interpreted as proof of the original execution environment.
Hosted collection requires a provider credential such as `HF_TOKEN`, which
must never be committed or published.

```bash
# Start the application separately. BASE may identify an equivalent local build.
for seed in 100 101 102 103 104; do
  BASE=http://localhost:3000 \
  HF_EXPERIMENT_ID=trace-regeneration-2026-09 \
  HF_EXPERIMENT_PHASE=hosted-qwen \
  HF_MODEL='Qwen/Qwen3.5-397B-A17B:deepinfra' \
  HF_MODEL_TYPE=non-thinking HF_ENABLE_THINKING=0 \
  HF_MAX_OUTPUT_TOKENS=16 HF_TEMPERATURE=0 \
  MAX_MOVES=25 SEED="$seed" npm run hf:bot
done

for seed in 100 101 102 103 104; do
  BASE=http://localhost:3000 \
  HF_EXPERIMENT_ID=trace-regeneration-2026-09 \
  HF_EXPERIMENT_PHASE=hosted-gpt-oss \
  HF_MODEL='openai/gpt-oss-120b:novita' \
  HF_MODEL_TYPE=reasoning-style HF_ENABLE_THINKING=1 \
  HF_MAX_OUTPUT_TOKENS=2048 HF_TEMPERATURE=0 \
  MAX_MOVES=25 SEED="$seed" npm run hf:bot
done

for seed in 100 101 102 103 104; do
  BASE=http://localhost:3000 \
  MODEL_EXPERIMENT_ID=trace-regeneration-2026-09 \
  MODEL_EXPERIMENT_PHASE=local-ollama-native \
  OLLAMA_MODEL=qwen3:8b MAX_MOVES=25 SEED="$seed" npm run ollama:bot
done

BASE=http://localhost:3000 \
HF_EXPERIMENT_ID=trace-regeneration-2026-09 \
HF_EXPERIMENT_PHASE=rollout-baseline \
ROLLOUT_TRACE_SEEDS=100,101,102,103,104 \
MAX_MOVES=25 npm run rollout:trace

npm run models:export:dataset
npm run research:release:audit
```

## Split guidance

The hosted, Ollama, and rollout tables are policy/source partitions, not
independent random train/test splits. Never place turns from the same `run_id`
in both training and evaluation because adjacent states leak trajectory
information. Group by `run_id` at minimum and retain matched seed groups for
cross-policy comparisons.

For an exploratory deterministic split, use seeds 100-102 for training, 103
for validation, and 104 for testing across every policy. With only five trace
seeds, leave-one-seed-out evaluation is also exploratory; neither approach is
a statistically robust held-out benchmark. Do not mix summary-only metrics
records into step-supervised training.

## Intended uses

- Reproduce and compare the recorded policy behavior.
- Study action selection when legal candidate outcomes are supplied.
- Exercise deterministic replay, feature, and Parquet pipelines.
- Provide small educational and integration-test examples.

This release is not suitable for safety-critical use, claims about human
ability, general language-model ranking, or deployment of a production policy
without independent evaluation.

## Limitations

- Five trace seeds, short horizons, one ruleset, and one 4×4 spawn setup.
- No human demonstrations, preferences, or broad gameplay distribution.
- Candidate boards reveal engine-evaluated outcomes; this is action selection,
  not raw environment modeling.
- Scores are not comparable to unrestricted full-length 2048 games.
- Hosted latency includes provider and network effects.
- Ollama seed 100 ran on an Intel build under translation; seeds 101-104 used a
  native Apple Silicon runtime. Do not aggregate them as one hardware result.
- Model identifiers are aliases, not immutable revisions. Provider revisions,
  Ollama version, and local model digest were not recorded.
- The recorded ruleset is `binary2048-v1`, but `engineVersion` is only `dev`;
  the precise engine build is not independently recoverable from the rows.
- Provider token accounting can treat reasoning tokens differently.
- Cost values are historical estimates, not current prices.
- The original command transcript was not retained; the recipe above is a
  reconstruction.

## License, attribution, and citation

The repository declares Apache-2.0. Formal dataset licensing and third-party
model/provider attribution remain subject to the owner approval recorded in
the V1 release audit. No model weights or provider outputs other than selected
game actions and associated usage/latency metadata are included.

Proposed citation, pending owner approval and creation of the immutable tag:

```bibtex
@dataset{binary2048_model_decision_traces_2026,
  author    = {Kelsey, Alan},
  title     = {Binary-2048 Model Decision Traces},
  year      = {2026},
  version   = {1.0.0},
  publisher = {GitHub},
  url       = {https://github.com/alankelsey/Binary-2048/releases/tag/model-benchmark-v1.0.0}
}
```
