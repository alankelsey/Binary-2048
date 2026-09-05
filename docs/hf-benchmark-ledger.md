# Hosted Model Benchmark Ledger

The machine-readable source is [`hf-benchmark-runs.json`](./hf-benchmark-runs.json).
The hosted runner updates it after every successfully completed game. Commit
the ledger together with the corresponding human-readable benchmark report.

Each record tracks:

- experiment ID, phase, track, ruleset, model ID, provider, and model type
- thinking mode, temperature, maximum output tokens, structured-output mode,
  and whether engine-calculated candidate boards were supplied
- deterministic seed, RNG description, moves, score, and maximum tile
- input, output, and separately reported reasoning tokens when the provider
  supplies that field
- fallback count and average, p95, and total model latency
- listed token-rate estimate, conservative observed-request estimate, and the
  rates used for both calculations
- the same-seed rollout score, moves, and maximum tile when available
- a versioned decision trace containing the complete action sequence and, for
  every turn, the encoded input state, action mask, legal actions, all
  engine-evaluated candidate boards, selected action, resulting state/hash,
  spawn/reward outcome, fallback flag, timestamps, tokens, and latency

`null` means the metric was not captured historically or a rollout comparison
was unavailable. It must not be replaced with a guess. A provider may include
reasoning inside its general output-token count while reporting zero separate
reasoning tokens; `model.type` and `model.thinkingEnabled` preserve that context.
Records captured before trace schema version 2 do not have a `trace`; they remain
valid benchmark summaries but cannot be exported as model training steps.

## Run metadata

Set these variables when starting an experiment:

```bash
HF_EXPERIMENT_ID=hf-two-phase-2026-09 \
HF_EXPERIMENT_PHASE=phase-2 \
HF_MODEL_TYPE=reasoning-style \
SEED=105 npm run hf:bot
```

The runner records to `docs/hf-benchmark-runs.json` by default. Override
`HF_RUN_LEDGER` for exploratory runs that should not update the tracked ledger.
Set `HF_COMPARE_ROLLOUT=0` only when the local rollout comparison is intentionally
disabled; the ledger will then record `rollout: null`.

## Export research splits

```bash
npm run models:export:dataset
```

This writes canonical JSONL files, derived Parquet files, SHA-256 checksums, and
`manifest.json` under `data/model-benchmark/`. Hosted, Ollama, and rollout
decisions are kept in separate step files, while `run_metrics` contains every
run summary. Empty step splits retain an empty JSONL file and omit Parquet until
at least one trace-complete row exists.
Schema-v1 historical summaries remain in metrics but are intentionally excluded
from step datasets because their move-level inputs and actions were not saved.
