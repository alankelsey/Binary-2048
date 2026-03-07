# Mongo Migration Trigger Thresholds

Move from in-memory sessions to Mongo persistence when any threshold is sustained for 7 days:

## Triggers

- Active sessions peak > `2,000`
- Daily replay exports > `25,000`
- Memory used by session store > `1.5 GB`
- Tournament/async match records requiring persistence > `10,000/day`

## Operational plan

1. Introduce dual-write (`memory + Mongo`) in non-ranked first.
2. Validate replay/export parity for 1 week.
3. Switch ranked/session reads to Mongo.
4. Keep memory fallback only for local dev/test.

## Data model targets

- sessions collection
- replay headers + moves collection
- leaderboard entries collection
- inventory ledger collection
