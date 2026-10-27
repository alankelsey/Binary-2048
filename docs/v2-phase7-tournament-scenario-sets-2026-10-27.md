# V2 Phase 7 tournament scenario-set evidence

Date: 2026-10-27 America/Boise

Status: complete.

## Artifact contract

- The scenario builder can collect multiple validated boards into a portable
  `binary2048-tournament-scenario-set` version 1 JSON artifact.
- Each entry contains a normalized name and tags, an explicit deterministic
  seed, complete configuration, game mode, initial grid, variant label, stable
  scenario ID, and stable board fingerprint.
- The set contains its own stable ID, name, normalized tags, creation and
  export timestamps, and ordered entries. Stable IDs derive from canonical
  content and do not change solely because an artifact is exported later.
- IDs and fingerprints organize authored artifacts and detect duplicates. They
  are deliberately not cryptographic signatures, competition approvals, or
  permission to enter ranked play.

## Variants and duplicate handling

- Authors can add the original board and optionally generate horizontal,
  vertical, and 180-degree mirrored variants without editing JSON.
- Transforms clone the exact authored configuration and seed. The source board
  remains unchanged.
- Board fingerprints detect duplicates within one variant batch and against
  scenarios already collected in the set. Duplicate boards are omitted and the
  visible status message reports how many were skipped.
- Authors can inspect the ordered set, remove individual entries, and export
  only after at least one scenario has been added.

## Authorization boundary

- Tournament-set export is an offline authoring action. It does not call the
  protected tournament execution API or grant research authorization.
- The existing tournament API remains the controlled execution surface, so an
  exported user-authored set cannot silently become a ranked or approved
  competition definition.

## Verification

- Three schema tests cover stable IDs across names and export timestamps,
  normalized tags, explicit seeds, every mirror transform, duplicate omission,
  empty-set rejection, and safe filenames.
- The scenario-builder Playwright suite passes 10 tests. Its tournament case
  builds an asymmetric board, selects every variant, verifies four entries,
  verifies four duplicates are omitted on a second add, downloads the JSON,
  and checks the format, set ID, entry IDs, board fingerprints, tags, variants,
  and seeds.
- A headless Chromium check at 390 × 844 confirms the populated tournament-set
  panel has zero horizontal overflow and keeps all controls usable.
- TypeScript, ESLint, focused spelling, and diff validation pass.
