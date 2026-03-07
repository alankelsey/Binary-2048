# Rate Limit Matrix (5-Minute Window)

This document defines concrete per-5-minute limits for Binary-2048 launch.

## Tier-level policy (app security posture)

Source: `lib/binary2048/security-policy.ts`

| Tier | Window | Max Requests | Challenge After | Block After |
|---|---:|---:|---:|---:|
| guest | 300s | 120 | 80 | 140 |
| authed | 300s | 600 | 500 | 700 |
| paid | 300s | 1800 | 1600 | 2000 |

Env overrides:

- `BINARY2048_RATE_LIMIT_GUEST_5M_MAX`
- `BINARY2048_RATE_LIMIT_GUEST_5M_CHALLENGE`
- `BINARY2048_RATE_LIMIT_GUEST_5M_BLOCK`
- `BINARY2048_RATE_LIMIT_AUTHED_5M_MAX`
- `BINARY2048_RATE_LIMIT_AUTHED_5M_CHALLENGE`
- `BINARY2048_RATE_LIMIT_AUTHED_5M_BLOCK`
- `BINARY2048_RATE_LIMIT_PAID_5M_MAX`
- `BINARY2048_RATE_LIMIT_PAID_5M_CHALLENGE`
- `BINARY2048_RATE_LIMIT_PAID_5M_BLOCK`

## Endpoint-specific API caps

Source: `lib/binary2048/rate-limit.ts`

| Endpoint | Keying | Window | Default Limit | Response on Exceed |
|---|---|---:|---:|---|
| `POST /api/simulate` | `x-api-key` else IP | 300s | 60 | `429` |
| `POST /api/bots/tournament` | `x-api-key` else IP | 300s | 10 | `429` |

Env overrides:

- `BINARY2048_RATE_LIMIT_SIMULATE_MAX`
- `BINARY2048_RATE_LIMIT_TOURNAMENT_MAX`
- `BINARY2048_RATE_LIMIT_WINDOW_MS` (shared window for both endpoint caps)

## Recommended launch values

Use defaults initially, then tune from telemetry:

- Keep guest strict.
- Raise authed first if false positives appear.
- Reserve paid tier increases for verified demand.
- Keep hard tournament caps to prevent CPU-cost spikes.
