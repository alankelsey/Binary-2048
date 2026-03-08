# ML Pipeline Notes

## Dataset Export (PII-safe JSONL)

Export persisted runs into an anonymized dataset:

```bash
BINARY2048_MONGO_URI="mongodb+srv://..." \
BINARY2048_MONGO_DB="binary2048" \
BINARY2048_MONGO_RUN_COLLECTION="runs" \
BINARY2048_DATASET_SALT="change-me" \
npm run runs:export:dataset
```

Output defaults to `data/runs-dataset.jsonl`.

## Feature Extraction

Derive numeric model inputs from dataset rows:

```bash
IN=data/runs-dataset.jsonl OUT=data/runs-features.jsonl npm run runs:extract:features
```

## Baseline Offline Train/Eval

Run a deterministic train/test split with a lightweight linear baseline and emit a JSON report:

```bash
IN=data/runs-features.jsonl OUT=data/ml-baseline-report.json npm run ml:baseline
```

## Model Version Pinning

Use `lib/binary2048/model-registry.ts` to register/retrieve policy versions and enforce explicit pinning in tournaments/ranked automation.

## Inference Safety Gate

Use `runInferenceWithSafetyGate(...)` in `lib/binary2048/inference-gate.ts` to:

- enforce timeout budgets
- fallback deterministically when model inference times out/fails
- log `seed`, `modelId`, and `modelVersion` for replay/audit parity
