# Binary-2048 Research Release Audit

Status: in progress
Audit started: 2026-09-29  
V1 target: existing public `alankelsey/Binary-2048` repository

## Release boundary

The application repository and checked-in dataset files are already public.
This audit therefore reviews existing exposure and gates an intentional,
immutable dataset release; it is not a repository-visibility change. V1 will
use the existing repository. Whether to create a dataset-only repository will
be reconsidered in V2.

The intended release bundle is limited to research documentation, a dataset
card/README, checksum manifest, license, and reviewed Parquet datasets. It must
not contain executable pickle files, source ledgers, JSONL working exports,
player or Mongo data, credentials, environment values, operational logs,
internal handoff notes, or deployment configuration.

## Evidence collected

- The original roadmap named `botvsbot/binary2048`, but Git history shows that
  name first appeared as an unsupported planning assumption in commit
  `73c2a6b`. It is not a configured remote or required release target.
- GitHub confirms `alankelsey/Binary-2048` is public with `main` as its default
  branch. The tracked files under `data/model-benchmark/` must therefore be
  treated as already published, including their Git history.
- The local canonical model-benchmark export contains four JSONL sources and
  four derived Parquet files under `data/model-benchmark/`.
- The recorded SHA-256 values for all eight generated files match
  `data/model-benchmark/manifest.json` as of this audit.
- `npm run research:release:audit` now enforces those file hashes and row
  counts, parses every canonical JSONL row, and rejects sensitive field names
  and credential-value patterns. CI runs this guard on every change.
- The canonical JSONL schemas expose deterministic research fields such as
  seed, ruleset, model configuration, boards, actions, outcomes, latency,
  token counts, and aggregate metrics. A targeted scan found no Mongo URI,
  AWS access-key pattern, private-key header, authorization/cookie/password/
  secret field, email field, or player/user identifier field.
- The trace-complete cohort uses seeds 100-104, export schema 1, and ruleset
  `binary2048-v1`. Aggregate metrics also contain older summary-only runs for
  seeds 105-114; those runs do not provide training steps.
- The ignored historical training archive contains `replay_buffer.pkl` and an
  internal `training-session-handoff.md`. Neither is eligible for publication.
- This repository is Apache-2.0 licensed, but ownership and third-party model/
  provider attribution for every proposed public artifact still require an
  explicit release decision.

## Blocking follow-ups

1. Inventory the existing repository's complete Git history, branches, tags, releases, Actions
   artifacts, LFS objects, issues, and current collaborators for secrets and
   non-release material. Scanning only the working tree is insufficient.
2. Build a clean release bundle from an allowlist within the existing
   repository; do not treat unrelated application files as dataset artifacts.
3. Expand the dataset card with provenance, engine/dataset/ruleset versions,
   exact generation command, RNG semantics, model policy versions,
   limitations, intended uses, citation, and split guidance.
4. Verify every Parquet column and row from decoded data, then rerun secret,
   identifier, and operational-metadata scans against the exact release
   bundle.
5. Record Binary-2048 ownership and the Apache-2.0/third-party attribution
   decision.
6. Create immutable checksums and a proposed version tag, review the staged
   artifact set, and obtain explicit approval before publishing the release.

## Current decision

Not yet approved as an intentional dataset release. Existing public exposure
is acknowledged, but history review, decoded Parquet review, documentation,
ownership/licensing confirmation, and an immutable release tag remain open.
No repository visibility or external state was changed by this audit.
