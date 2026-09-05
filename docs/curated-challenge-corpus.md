# Curated Fixed-Board Challenge Corpus

The versioned corpus at
`data/model-benchmark/challenge-corpus.v1.json` defines the second bot-evaluation
track. Unlike the seeded-game track, every bot begins from an explicit board.
This isolates tactical skills and prevents a favorable spawn sequence from
masking a weak decision policy.

## Version 1 coverage

| Scenario | Move horizon | Primary skills |
|---|---:|---|
| `number-double-merge` | 1 | Number merging, multi-merge scoring |
| `zero-wildcard-annihilation` | 1 | Zero annihilation, board clearing |
| `wildcard-multiplier` | 1 | Wildcard multiplication |
| `lock-cooldown-block` | 2 | Lock-zero cooldown and hazard awareness |
| `immediate-target-merge` | 1 | Win detection and tactical finishing |
| `asymmetric-edge-choice` | 4 | Dense-board spatial planning and Bitstorm play |

Each scenario contains a stable ID and version, full game configuration,
explicit initial grid, skill tags, maximum move horizon, and expected engine
invariants. The validation code executes every probe and checks occupied cells,
legal actions, score changes, merge/event behavior, tile outcomes, and wins.

## Replay compatibility

Corpus version 1 uses `binary2048-v1` and compact replay version 1. A benchmark
result can therefore be represented by the scenario's `config` and
`initialGrid` plus the bot's ordered actions. Scenario revisions must increment
`scenarioVersion`; incompatible collection-level changes require a new corpus
schema and file rather than silently changing version 1.

## Reporting contract

The seeded and curated tracks must be reported separately. Curated results
should include corpus/scenario versions, action sequence, score delta, maximum
tile, completed moves, invariant or objective result, decision latency, token
usage, fallbacks, model metadata, and estimated cost. Aggregates should include
per-skill results so a strong merge score cannot hide failures on zeros,
wildcards, or lock cooldowns.

## Running the benchmark

Start the application API, then run the free rollout baseline:

```bash
npm run challenge:benchmark
```

Select local Ollama with `CHALLENGE_ADAPTER=ollama`. Select Hugging Face with
`CHALLENGE_ADAPTER=hf CHALLENGE_ALLOW_HOSTED=1`; hosted runs require `HF_TOKEN`
and are rejected before the first request if the conservative estimate exceeds
`CHALLENGE_MAX_ESTIMATED_COST_USD` (default `$1.00`). Use
`CHALLENGE_SCENARIOS=id-one,id-two` to run a subset.

Results are upserted into `docs/challenge-benchmark-runs.json`, and the separate
fixed-board summary is regenerated at `docs/challenge-benchmark-latest.md`.
