# Binary-2048 Research Release Audit

Status: in progress; release remains blocked  
Audit started: 2026-09-29  
Target named in the roadmap: `botvsbot/binary2048`

## Release boundary

This audit does not authorize changing repository visibility. The target must
remain private until every roadmap gate is proven, the exact release contents
are reviewed, and the owner explicitly approves publication.

The intended release bundle is limited to research documentation, a dataset
card/README, checksum manifest, license, and reviewed Parquet datasets. It must
not contain executable pickle files, source ledgers, JSONL working exports,
player or Mongo data, credentials, environment values, operational logs,
internal handoff notes, or deployment configuration.

## Evidence collected

- `gh repo view botvsbot/binary2048` could not resolve the repository for the
  currently authenticated GitHub identity. A read-only organization listing
  also did not return that repository. Its current visibility, history,
  collaborators, branches, and files are therefore unverified.
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

1. Confirm the correct target repository name/owner and grant the auditing
   identity read access without changing visibility.
2. Inventory its complete Git history, branches, tags, releases, Actions
   artifacts, LFS objects, issues, and current collaborators for secrets and
   non-release material. Scanning only the working tree is insufficient.
3. Build a clean release bundle from an allowlist; do not copy the current
   repository or its history wholesale.
4. Expand the dataset card with provenance, engine/dataset/ruleset versions,
   exact generation command, RNG semantics, model policy versions,
   limitations, intended uses, citation, and split guidance.
5. Verify every Parquet column and row from decoded data, then rerun secret,
   identifier, and operational-metadata scans against the exact release
   bundle.
6. Record Binary-2048 ownership and the Apache-2.0/third-party attribution
   decision.
7. Create immutable checksums and a proposed version tag, review the staged
   artifact set, and obtain explicit approval before changing visibility.

## Current decision

Declined for release at this checkpoint because the named target repository is
not accessible for audit. No repository visibility or external state was
changed. The local evidence is useful preparation but does not satisfy the
public-release gate.
