# Replay Retention Policy

## Goals

- Keep hot replay metadata queryable for gameplay/ranked UX.
- Move bulky replay payloads to cheaper storage tiers.
- Apply stricter retention for guest/untrusted data.

## Retention Tiers

### Tier 1: Hot (Mongo)

- Scope:
  - canonical run metadata
  - compact replay payload for recent runs
- TTL:
  - ranked/authed/paid: 30 days
  - guest: 7 days

### Tier 2: Warm (S3)

- Scope:
  - compressed replay payloads for top scores/contests
- Lifecycle:
  - Standard -> Intelligent Tiering after 30 days
  - Glacier Instant Retrieval after 90 days
  - Delete after 365 days (unless legal/contest hold)

### Tier 3: Purge

- Guest replay payloads:
  - removed from warm tier after 30 days
- Orphaned payloads (missing Mongo pointer):
  - removed by weekly sweeper

## Deletion Rules

- User-initiated delete:
  - remove Mongo run records for user
  - enqueue S3 object delete by pointer ids
- Contest/legal hold:
  - explicit hold tag prevents lifecycle deletion

## Operational Controls

- Weekly retention sweeper:
  - expire aged guest runs
  - verify pointer/object consistency
- Monthly restore drill:
  - sample warm objects -> restore -> checksum verify
