# V2 Phase 7 scenario JSON round-trip evidence

Date: 2026-10-27 America/Boise

Status: complete.

## Format contract

- Portable files identify themselves with `format: "binary2048-scenario"` and
  `version: 1`. They are not game exports or completed replays.
- Each file contains authoring name, creation/export timestamps, authoring tool,
  full configuration, explicit seed, game mode, placement symmetry, and initial
  grid.
- The format deliberately contains no moves, step log, score, final board,
  leaderboard integrity, or completed-run claims.
- Import requires the exact format and supported version, structurally validates
  dimensions, configuration, every cell, mode, and symmetry, and verifies that
  the explicit seed equals the configuration seed.
- Imports are limited to 256 KB. Malformed JSON, replay objects, unsupported
  versions, invalid authoring metadata, and inconsistent seeds produce concise
  errors without replacing the current board.

## User experience

- Export downloads a readable, safely named `.scenario.json` file. The current
  draft name is used when available, with `Untitled scenario` as the fallback.
- Import restores the scenario as editable authoring state, resets undo/redo
  history, clears the selected palette tile, restores the authoring name, and
  announces success through visible and screen-reader status regions.
- The Scenario JSON panel explicitly explains that these files contain
  authoring state rather than replay moves or results.

## Verification

- Three format tests cover a round trip with number, zero, wildcard, and Lock-0
  tiles; game mode; symmetry; configuration; seed; metadata; safe filenames;
  and rejection of malformed, replay, unknown-version, and mismatched-seed
  inputs.
- The scenario format, draft, and builder suites pass 15 focused unit tests.
- The scenario-builder Playwright suite passes 8 tests. Chromium performs an
  actual download, inspects the JSON contract and absence of replay fields,
  resets the board, uploads the downloaded file, and verifies the restored
  symmetry and tiles.
- TypeScript, ESLint, spelling, and diff validation pass.
