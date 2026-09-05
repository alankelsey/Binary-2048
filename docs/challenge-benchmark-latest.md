# Curated Challenge Benchmark

Corpus: `binary2048-curated-challenges` v1.0.0 · Ruleset: `binary2048-v1`

This fixed-board track is reported separately from deterministic seeded games.

| Model | Provider | Passed | Pass rate | Moves | Score | Input tokens | Output tokens | Fallbacks | Avg latency | Conservative cost |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| rollout | rollout | 3/6 | 50.0% | 10 | 2231 | 0 | 0 | 0 | 18 ms | $0.0000 |
| qwen3:8b | ollama | 3/6 | 50.0% | 10 | 2200 | 3975 | 60 | 0 | 972 ms | $0.0000 |
| Qwen/Qwen3.5-397B-A17B:deepinfra | deepinfra | 3/6 | 50.0% | 10 | 2200 | 4045 | 60 | 0 | 878 ms | $0.0714 |

## Scenario results

| Scenario | Model | Selected | Expected | Pass | Score | Max tile | Moves |
|---|---|---|---|---:|---:|---:|---:|
| number-double-merge v1 | rollout | D | L, R | no | 0 | 2 | 1 |
| zero-wildcard-annihilation v1 | rollout | D | L | no | 2 | 2 | 1 |
| wildcard-multiplier v1 | rollout | R | L, R | yes | 32 | 32 | 1 |
| lock-cooldown-block v1 | rollout | R | R | yes | 1 | 1 | 2 |
| immediate-target-merge v1 | rollout | L | L | yes | 2048 | 2048 | 1 |
| asymmetric-edge-choice v1 | rollout | D | R | no | 148 | 128 | 4 |
| number-double-merge v1 | qwen3:8b | L | L, R | yes | 6 | 4 | 1 |
| zero-wildcard-annihilation v1 | qwen3:8b | U | L | no | 2 | 2 | 1 |
| wildcard-multiplier v1 | qwen3:8b | L | L, R | yes | 32 | 32 | 1 |
| lock-cooldown-block v1 | qwen3:8b | D | R | no | 2 | 2 | 2 |
| immediate-target-merge v1 | qwen3:8b | L | L | yes | 2048 | 2048 | 1 |
| asymmetric-edge-choice v1 | qwen3:8b | U | R | no | 110 | 128 | 4 |
| number-double-merge v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | L | L, R | yes | 6 | 4 | 1 |
| zero-wildcard-annihilation v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | U | L | no | 2 | 2 | 1 |
| wildcard-multiplier v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | L | L, R | yes | 32 | 32 | 1 |
| lock-cooldown-block v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | D | R | no | 2 | 2 | 2 |
| immediate-target-merge v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | L | L | yes | 2048 | 2048 | 1 |
| asymmetric-edge-choice v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | U | R | no | 110 | 128 | 4 |

## Skill results

| Model | Skill | Passed | Pass rate |
|---|---|---:|---:|
| rollout | number-merge | 1/2 | 50.0% |
| rollout | score-maximization | 1/2 | 50.0% |
| rollout | multi-merge | 0/1 | 0.0% |
| rollout | zero-annihilation | 0/1 | 0.0% |
| rollout | wildcard | 1/2 | 50.0% |
| rollout | board-clearing | 0/1 | 0.0% |
| rollout | multiplication | 1/1 | 100.0% |
| rollout | lock-zero | 1/1 | 100.0% |
| rollout | cooldown | 1/1 | 100.0% |
| rollout | hazard-avoidance | 1/1 | 100.0% |
| rollout | win-detection | 1/1 | 100.0% |
| rollout | tactical-finish | 1/1 | 100.0% |
| rollout | spatial-planning | 0/1 | 0.0% |
| rollout | edge-preservation | 0/1 | 0.0% |
| rollout | dense-board | 0/1 | 0.0% |
| rollout | bitstorm | 0/1 | 0.0% |
| qwen3:8b | number-merge | 2/2 | 100.0% |
| qwen3:8b | score-maximization | 2/2 | 100.0% |
| qwen3:8b | multi-merge | 1/1 | 100.0% |
| qwen3:8b | zero-annihilation | 0/1 | 0.0% |
| qwen3:8b | wildcard | 1/2 | 50.0% |
| qwen3:8b | board-clearing | 0/1 | 0.0% |
| qwen3:8b | multiplication | 1/1 | 100.0% |
| qwen3:8b | lock-zero | 0/1 | 0.0% |
| qwen3:8b | cooldown | 0/1 | 0.0% |
| qwen3:8b | hazard-avoidance | 0/1 | 0.0% |
| qwen3:8b | win-detection | 1/1 | 100.0% |
| qwen3:8b | tactical-finish | 1/1 | 100.0% |
| qwen3:8b | spatial-planning | 0/1 | 0.0% |
| qwen3:8b | edge-preservation | 0/1 | 0.0% |
| qwen3:8b | dense-board | 0/1 | 0.0% |
| qwen3:8b | bitstorm | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | number-merge | 2/2 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | score-maximization | 2/2 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | multi-merge | 1/1 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | zero-annihilation | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | wildcard | 1/2 | 50.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | board-clearing | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | multiplication | 1/1 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | lock-zero | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | cooldown | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | hazard-avoidance | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | win-detection | 1/1 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | tactical-finish | 1/1 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | spatial-planning | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | edge-preservation | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | dense-board | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | bitstorm | 0/1 | 0.0% |
