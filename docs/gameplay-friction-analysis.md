# Gameplay Friction Analysis

## Metrics

- No-op move ratio by input type (swipe/keyboard/API)
- Early quits (<= N moves)
- Loss reason tags (board full, lock pressure, 0-tile chain break)
- Undo pressure (undo attempts exhausted)

## Analysis Cadence

- Daily: anomaly check
- Weekly: mode/difficulty comparison
- Release-level: regression summary

## Action Policy

- If no-op ratio rises >10% after release, review input handling.
- If early quits spike in a mode, tune spawn/bonus balance.
