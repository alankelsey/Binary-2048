# Mongo + S3 Cost Guardrails

## MongoDB Guardrails

- Budgets:
  - Daily and monthly budget alarms at 50/80/100%.
- Data lifecycle:
  - TTL for guest runs/replays.
  - Keep ranked runs longer than unranked.
- Query controls:
  - Cap expensive aggregations.
  - Required indexes for leaderboard/runs queries.
- Throughput controls:
  - Limit training export page size.
  - Backoff/retry for batch jobs.

## S3 Guardrails

- Lifecycle:
  - Transition replay artifacts to IA/Glacier tiers.
  - Expire old temporary exports.
- Object hygiene:
  - Prefix by env (`prod/`, `dev/`) and data class.
  - Enforce size caps per artifact.
- Billing alerts:
  - Storage size and request count alarms.

## Operational Limits

- Hard caps on tournament seeds and max moves.
- Rate limits on replay export/import endpoints.
- Emergency degrade mode for heavy endpoints.
