# Staged Gameplay Load Result (Latest)

- Generated: 2026-03-07T16:37:40.057Z
- Target: https://www.binary2048.com
- Overall: FAIL

## baseline

- Config: concurrency=8, iterations=80
- Result: FAIL
- Error rate: 22.50%
- Total p95: 2668.1ms
- Throughput: 16.05 req/s

## ramp

- Config: concurrency=16, iterations=160
- Result: FAIL
- Error rate: 38.13%
- Total p95: 339.7ms
- Throughput: 63.62 req/s

## stress-lite

- Config: concurrency=24, iterations=240
- Result: FAIL
- Error rate: 45.83%
- Total p95: 305.5ms
- Throughput: 89.77 req/s
