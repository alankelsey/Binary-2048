# ML Training Data Policy

## Consent Classes

- `operational_only`: metrics only, not for model training.
- `product_improvement`: eligible for aggregate training sets.
- `full_research`: eligible for advanced model training workflows.

## Allowed Data

- Encoded state/action mask/labels
- Replay-derived aggregate stats
- No raw personal identifiers

## Retention

- Raw logs: short retention.
- Feature tables: medium retention.
- Model datasets: versioned snapshots with purge policy.

## Compliance

- Data export/delete must remove user-linked training records where feasible.
- Audit log of dataset generation jobs retained.
