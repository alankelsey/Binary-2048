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
| `POST /api/games/:id/move` | validated bot key ID else IP | 300s | 600 | `429` |
| `POST /api/simulate` | validated bot key ID else IP | 300s | 60 | `429` |
| `POST /api/bots/tournament` | validated bot key ID else IP | 300s | 10 | `429` |
| Training replay/label routes | shared bucket by validated bot key ID else IP | 300s | 20 | `429` |

Env overrides:

- `BINARY2048_RATE_LIMIT_MOVE_MAX`
- `BINARY2048_RATE_LIMIT_SIMULATE_MAX`
- `BINARY2048_RATE_LIMIT_TOURNAMENT_MAX`
- `BINARY2048_RATE_LIMIT_TRAINING_MAX`
- `BINARY2048_RATE_LIMIT_WINDOW_MS` (shared window for both endpoint caps)
- `BINARY2048_BOT_API_KEY_HASHES` (comma-separated `bot-id=sha256hex` entries)

Unknown `x-api-key` values use the IP fallback instead of creating new quota
identities. Responses that consume quota include `RateLimit-Limit`,
`RateLimit-Remaining`, and `RateLimit-Reset`. A `429` also includes
`Retry-After` in seconds.

## WAF abuse backstop

AWS WAF is deliberately broader than the application quotas: it blocks at
6,000 requests per five minutes per IP for paths starting with `/api/`, and at
12,000 requests per five minutes per IP globally. These are emergency abuse
backstops, not bot quotas. There are no CAPTCHA or Challenge rules on gameplay
or bot API routes because non-browser clients cannot reliably complete them.

Validated API keys remain the quota identity at the application layer. WAF is
IP-keyed, so callers sharing NAT or proxy addresses also share its much larger
backstop. WAF sampled requests and CloudWatch metrics are enabled, and retained
request logs use the `aws-waf-logs-binary2048` log group with 30-day retention.

For multi-instance enforcement, set `BINARY2048_RATE_LIMIT_STORE=mongo`. Atomic
fixed-window counters are stored in
`BINARY2048_MONGO_RATE_LIMIT_COLLECTION` (default `rate_limits`) and expired by
a Mongo TTL index. The shared store uses the same validated bot-key identity and
route buckets shown above. If Atlas is temporarily unavailable, requests fall
back to a per-instance memory counter and emit an application error log; this
preserves local protection and availability, but the fallback interval is not a
globally strict quota window.

## Heavy-work concurrency pools

Tournament and training requests use independent bounded pools. The training
replay and label routes share one pool with defaults of 1 active request and 2
queued requests. Saturation returns `503` with `queue_full` or `queue_timeout`
and `Retry-After`. Configure it with `BINARY2048_TRAINING_MAX_CONCURRENT`,
`BINARY2048_TRAINING_MAX_QUEUE`, and
`BINARY2048_TRAINING_QUEUE_WAIT_TIMEOUT_MS`.

These per-instance pools bound concurrency but do not provide hard CPU isolation
inside a shared Node.js runtime. Moving heavy generation to a dedicated worker
service remains required before claiming full gameplay isolation.

## Recommended launch values

Use defaults initially, then tune from telemetry:

- Keep guest strict.
- Raise authed first if false positives appear.
- Reserve paid tier increases for verified demand.
- Keep hard tournament caps to prevent CPU-cost spikes.
