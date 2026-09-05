# Curated Challenge Benchmark

Corpus: `binary2048-curated-challenges` v1.0.0 · Ruleset: `binary2048-v1`

This fixed-board track is reported separately from deterministic seeded games.

| Model | Provider | Type | Thinking | Max output | Passed | Pass rate | Moves | Score | Input tokens | Output tokens | Fallbacks | Avg latency | Conservative cost |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| rollout | rollout | monte-carlo-rollout | no | n/a | 3/6 | 50.0% | 10 | 2231 | 0 | 0 | 0 | 18 ms | $0.0000 |
| qwen3:8b | ollama | non-thinking | no | 16 | 3/6 | 50.0% | 10 | 2200 | 3975 | 60 | 0 | 972 ms | $0.0000 |
| Qwen/Qwen3.5-397B-A17B:deepinfra | deepinfra | non-thinking | no | 16 | 3/6 | 50.0% | 10 | 2200 | 4045 | 60 | 0 | 878 ms | $0.0714 |
| Qwen/Qwen3.5-397B-A17B:deepinfra | deepinfra | reasoning-style | yes | 512 | 0/6 | 0.0% | 10 | 2200 | 4077 | 5120 | 10 | 16156 ms | $0.0714 |
| Qwen/Qwen3.5-397B-A17B:deepinfra | deepinfra | reasoning-style | yes | 2048 | 0/1 | 0.0% | 1 | 6 | 362 | 2048 | 1 | 69262 ms | $0.0071 |

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
| number-double-merge v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | L | L, R | no | 6 | 4 | 1 |
| zero-wildcard-annihilation v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | U | L | no | 2 | 2 | 1 |
| wildcard-multiplier v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | L | L, R | no | 32 | 32 | 1 |
| lock-cooldown-block v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | R | R | no | 2 | 2 | 2 |
| immediate-target-merge v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | L | L | no | 2048 | 2048 | 1 |
| asymmetric-edge-choice v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | U | R | no | 110 | 128 | 4 |
| number-double-merge v1 | Qwen/Qwen3.5-397B-A17B:deepinfra | L | L, R | no | 6 | 4 | 1 |

## Skill results

| Model | Type | Max output | Skill | Passed | Pass rate |
|---|---|---:|---|---:|---:|
| rollout | monte-carlo-rollout | n/a | number-merge | 1/2 | 50.0% |
| rollout | monte-carlo-rollout | n/a | score-maximization | 1/2 | 50.0% |
| rollout | monte-carlo-rollout | n/a | multi-merge | 0/1 | 0.0% |
| rollout | monte-carlo-rollout | n/a | zero-annihilation | 0/1 | 0.0% |
| rollout | monte-carlo-rollout | n/a | wildcard | 1/2 | 50.0% |
| rollout | monte-carlo-rollout | n/a | board-clearing | 0/1 | 0.0% |
| rollout | monte-carlo-rollout | n/a | multiplication | 1/1 | 100.0% |
| rollout | monte-carlo-rollout | n/a | lock-zero | 1/1 | 100.0% |
| rollout | monte-carlo-rollout | n/a | cooldown | 1/1 | 100.0% |
| rollout | monte-carlo-rollout | n/a | hazard-avoidance | 1/1 | 100.0% |
| rollout | monte-carlo-rollout | n/a | win-detection | 1/1 | 100.0% |
| rollout | monte-carlo-rollout | n/a | tactical-finish | 1/1 | 100.0% |
| rollout | monte-carlo-rollout | n/a | spatial-planning | 0/1 | 0.0% |
| rollout | monte-carlo-rollout | n/a | edge-preservation | 0/1 | 0.0% |
| rollout | monte-carlo-rollout | n/a | dense-board | 0/1 | 0.0% |
| rollout | monte-carlo-rollout | n/a | bitstorm | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | number-merge | 2/2 | 100.0% |
| qwen3:8b | non-thinking | 16 | score-maximization | 2/2 | 100.0% |
| qwen3:8b | non-thinking | 16 | multi-merge | 1/1 | 100.0% |
| qwen3:8b | non-thinking | 16 | zero-annihilation | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | wildcard | 1/2 | 50.0% |
| qwen3:8b | non-thinking | 16 | board-clearing | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | multiplication | 1/1 | 100.0% |
| qwen3:8b | non-thinking | 16 | lock-zero | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | cooldown | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | hazard-avoidance | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | win-detection | 1/1 | 100.0% |
| qwen3:8b | non-thinking | 16 | tactical-finish | 1/1 | 100.0% |
| qwen3:8b | non-thinking | 16 | spatial-planning | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | edge-preservation | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | dense-board | 0/1 | 0.0% |
| qwen3:8b | non-thinking | 16 | bitstorm | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | number-merge | 2/2 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | score-maximization | 2/2 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | multi-merge | 1/1 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | zero-annihilation | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | wildcard | 1/2 | 50.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | board-clearing | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | multiplication | 1/1 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | lock-zero | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | cooldown | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | hazard-avoidance | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | win-detection | 1/1 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | tactical-finish | 1/1 | 100.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | spatial-planning | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | edge-preservation | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | dense-board | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | non-thinking | 16 | bitstorm | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | number-merge | 0/2 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | score-maximization | 0/2 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | multi-merge | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | zero-annihilation | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | wildcard | 0/2 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | board-clearing | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | multiplication | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | lock-zero | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | cooldown | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | hazard-avoidance | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | win-detection | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | tactical-finish | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | spatial-planning | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | edge-preservation | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | dense-board | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 512 | bitstorm | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 2048 | number-merge | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 2048 | score-maximization | 0/1 | 0.0% |
| Qwen/Qwen3.5-397B-A17B:deepinfra | reasoning-style | 2048 | multi-merge | 0/1 | 0.0% |
