# Heavy Route Abuse Result (Latest)

- Generated: 2026-03-07T17:05:00.415Z
- Target: https://www.binary2048.com
- Concurrency: 12
- Iterations: 180
- Overall: PASS

- p95: 6400.9ms
- 5xx rate: 0.00%
- Disallowed responses: 0

## Status counts

- 200: 85
- 400: 46
- 403: 49

## Scenario counts

- simulate_invalid_move: 46
- simulate_oversized_payload: 49
- tournament_bounded: 45
- tournament_oversized: 40