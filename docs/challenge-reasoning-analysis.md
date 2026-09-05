# Hosted Reasoning Challenge Analysis

Model: `Qwen/Qwen3.5-397B-A17B:deepinfra`  
Corpus: `binary2048-curated-challenges` v1.0.0

## Reasoning attempts

| Scope | Max output tokens | Valid model decisions | Fallbacks | Outcome |
|---|---:|---:|---:|---|
| All six scenarios | 512 | 0/10 | 10 | Every response exhausted the allowance before returning the required JSON action. |
| First scenario | 2,048 | 0/1 | 1 | The remaining broad retry was stopped after the first response also exhausted its allowance. |
| Dense-board scenario | 4,096 | 0 | 0 | The first provider request returned HTTP 504 after roughly two minutes; no move or trace was recorded. |

Fallback actions do not receive challenge credit. The report and ledger were
corrected accordingly. The 512-token cohort therefore scores 0/6, not the 4/6
that its deterministic fallback actions appeared to achieve.

## Dense-board decision

The first-step engine candidates were identical for rollout, local Qwen, and
hosted Qwen:

| Action | Immediate score | Empty cells | Max tile | Merges | Terminal |
|---|---:|---:|---:|---:|---:|
| U | 80 | 2 | 128 | 2 | no |
| D | 12 | 2 | 128 | 2 | no |
| L | 80 | 2 | 128 | 2 | no |
| R | 12 | 2 | 128 | 2 | no |

Both non-thinking Qwen runs selected `U`; rollout selected `D`. The current
scenario probe prefers `R` for edge preservation, but its immediate engine
features are weaker than `U` and `L`. Until the preferred action is supported
by an exhaustive or stronger multi-step reference evaluation, this scenario is
useful for comparing decisions but should not be cited as a definitive pass/fail
measure of model intelligence.
