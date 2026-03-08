# Run Index Strategy + Query SLO

## Mongo Run Indexes

The run store defines these indexes for persisted canonical runs:

- `uniq_run_id`: `{ id: 1 }` (unique)
- `player_created_desc`: `{ playerId: 1, createdAtISO: -1 }`
- `ruleset_score_desc`: `{ rulesetId: 1, score: -1, createdAtISO: -1 }`
- `contest_score_desc`: `{ contestId: 1, score: -1, createdAtISO: -1 }`

## Query Targets

- `GET /api/runs/:id`
  - p95 latency target: `< 120 ms`
- `GET /api/runs/:id/replay`
  - p95 latency target: `< 180 ms`
- leaderboard-oriented run queries (future list routes):
  - p95 latency target: `< 250 ms` for top 100 rows

## Operational Notes

- These indexes are created automatically when `BINARY2048_RUN_STORE=mongo`.
- For contest-heavy traffic, ensure `contestId` is always set on contest submissions to avoid sparse query scans.
- Monitor Atlas slow query logs and adjust compound index order if query shapes drift.
