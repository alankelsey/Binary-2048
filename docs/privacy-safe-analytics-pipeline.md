# Privacy-Safe Analytics Pipeline

## Ingest

- Client -> `/api/ops/telemetry` with schema validation.
- Reject payloads missing required fields or with blocked keys.

## Processing

- Strip/transform identifiers to pseudonymous IDs.
- Enforce event schema versioning.
- Drop unknown event names by default.

## Storage

- Partitioned storage by date/event type.
- Separate prod/dev telemetry buckets.
- Retention windows by event class.

## Access

- Role-based read access.
- Aggregated dashboard views by default.
- Raw event access only for incident/debug roles.
