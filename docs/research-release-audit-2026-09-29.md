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
  counts, parses every canonical JSONL row, decodes every Parquet row, requires
  each embedded Parquet record to match its canonical row, and rejects
  sensitive field names and credential-value patterns. CI runs this guard on
  every change.
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
- The four decoded Parquet tables contain 250 hosted steps, 125 Ollama steps,
  112 rollout steps, and 40 metrics rows. All 527 embedded records match the
  canonical JSONL in file order. Decoded schemas and values contain no player,
  account, email, MongoDB, credential, secret, environment, internal host,
  URL, IP address, filesystem path, or token-pattern data. Opaque benchmark
  run IDs and state hashes remain public research provenance with no linkage
  fields.
- The full reachable local history contains 359 commits. Dataset files first
  entered public history in `b47ffa3`, with later changes in `6ed3904`,
  `052cbe8`, `578df7a`, and `222169b`. Targeted history-wide scans found no
  private-key header, AWS access-key pattern, GitHub token prefix, or real
  MongoDB URI. Documented placeholders and test addresses were not treated as
  credentials.
- GitHub currently reports two branches, no tags, no releases, one merged
  same-repository pull request, one current collaborator (`alankelsey`), no
  secret-scanning alerts, and no evidence of Git LFS pointers/configuration.
  One pull-request commit exposes the local author email
  `akelsey@MacBook-Pro.local`; this is privacy metadata, not a credential or a
  dataset field.
- GitHub Actions retains 84 `prod-digest-fingerprints` artifacts. Metadata and
  the newest representative contain deployment provenance and an empty digest
  record, not dataset rows or secrets. Every historical log/artifact was not
  downloaded, so deleted state and expired artifacts cannot be proven absent.
- `DATASET_CARD.md` now records provenance, composition, policies, RNG/schema,
  intended uses, limitations, a reconstructed reproduction recipe, grouped
  split guidance, and a proposed citation. It explicitly states that the
  engine build, immutable model revisions, Ollama version/digest, and original
  shell transcript were not retained.
- `release-manifest.json` proposes version `1.0.0` and tag
  `model-benchmark-v1.0.0`. It allowlists the dataset card, checksum manifest,
  repository license, and four Parquet files. JSONL, source ledgers, artifacts,
  pickle files, environment files, logs, and handoffs are excluded.

## Blocking follow-ups

1. Record Binary-2048 ownership and the Apache-2.0/third-party attribution
   decision.
2. Review the allowlisted candidate and obtain explicit approval for version
   `1.0.0` and tag `model-benchmark-v1.0.0` before publishing the release.
3. After publication, verify the tag target, release asset names, sizes, and
   SHA-256 checksums against `release-manifest.json`.

## Current decision

Not yet approved as an intentional dataset release. Existing public exposure
is acknowledged. History and decoded-content reviews, the dataset card, and
the allowlisted candidate manifest are complete. Ownership/licensing approval
and the immutable release remain open. No repository visibility, tag, release,
or other external state was changed by this audit.
