# Local Ollama Bot Baseline

This adapter runs a pretrained local LLM as an experimental zero-shot Binary
2048 policy. It does not use or require the Binary-2048 training dataset.

## Local setup

```bash
brew services start ollama
ollama pull qwen3:8b
npm run ollama:check
```

Start Binary-2048 locally in another terminal, then run a short game:

```bash
npm run dev
MAX_MOVES=25 npm run ollama:bot
```

Configuration:

- `OLLAMA_BASE` defaults to `http://127.0.0.1:11434`.
- `OLLAMA_MODEL` defaults to `qwen3:8b`.
- `BASE` defaults to `http://localhost:3000`.
- `MAX_MOVES` defaults to `25` because LLM inference is much slower than the
  built-in search policies.

The adapter requests a JSON-schema-constrained `L`, `R`, `U`, or `D` action,
validates it against the engine-provided legal-action list, and records any
deterministic fallback. It also sends the encoded endpoint's state hash with
each move so stale decisions cannot mutate a newer board.

This is a local benchmark and is not part of the production tournament API.
Compare its score, fallback count, and per-move latency with the built-in
rollout bot before considering further integration.

