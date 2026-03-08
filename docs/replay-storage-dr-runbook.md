# Replay Storage Disaster Recovery Runbook

## Scope

Recover replay metadata (Mongo) and replay artifacts (S3) after corruption, accidental deletion, or region/service outage.

## Recovery Objectives

- RPO: <= 24h for replay artifacts and metadata.
- RTO: <= 2h for read-path restoration.

## Prerequisites

- Mongo backup snapshots enabled.
- S3 versioning/lifecycle configured.
- Checksums stored with replay artifacts.

## Drill Procedure

1. Select timestamped restore point.
2. Restore Mongo backup to isolated recovery cluster.
3. Restore replay objects from S3 version/snapshot set.
4. Run checksum verification pass.
5. Run sample replay determinism validation (`/api/replay/validate`).
6. Cut traffic (or switch read source) to recovered data plane.

## Verification

- Random 100 replay IDs load successfully.
- Checksum mismatch rate is 0.
- Leaderboard references resolve to valid replay pointers.

## Postmortem

- Record blast radius, root cause, and prevention controls.
