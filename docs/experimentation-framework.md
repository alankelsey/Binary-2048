# Experimentation Framework (A/B)

## Objectives

- Enable controlled UI/product experiments with guardrails.

## Model

- Experiment key + variant assignment (`control`, `treatment`).
- Sticky assignment by hashed user/session key.
- Holdout group support for baseline measurement.

## Guardrails

- Stop experiment if error rate or latency regresses past threshold.
- Keep ranked integrity unaffected by experimental UI changes.

## Reporting

- Conversion and retention deltas with confidence windows.
- Segment by user tier, device class, mode.
