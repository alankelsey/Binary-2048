# V2 Phase 7 scenario-builder test coverage evidence

Date: 2026-10-27 America/Boise

Status: complete.

## Coverage matrix

| Requirement | Unit or schema coverage | Playwright coverage |
| --- | --- | --- |
| Every tile type | Labels, immutable placement, schema validation, and scenario JSON round trip cover number, zero, wildcard, Lock-0, and empty cells. | A single browser flow places a number, zero, Lock-0, and every configured wildcard multiplier. |
| Placement, replacement, and clearing | Immutable placement tests cover place, replace, and erase. | Accessible controls place, replace, erase, paint by pointer drag, and reset. |
| Undo and redo | History tests cover commit, undo, redo, redo invalidation, and no-op commits. | Browser history controls restore replacement and symmetric edits; keyboard editing history is announced. |
| Symmetry | Coordinate and board tests cover horizontal, vertical, rotational, four-way, and center-axis de-duplication. | All four symmetry modes are placed, announced, and undone as atomic edits. |
| Validation and engine preview | Unit tests cover dimensions, seed, win tile, spawn totals, wildcard support, legal moves, and deterministic engine previews. | Browser tests observe invalid-to-valid transitions, legal moves, seeded previews, and invalid configuration feedback. |
| Draft persistence | Draft schema tests cover versioning, cloning, bounded identity, corruption rejection, ordering, and updates; API tests cover authenticated owner-scoped list/save/delete. | Local drafts are saved, survive reload, restore exact board state, and delete. |
| JSON round trips | Format tests cover versioned configuration, seed, every tile type, mode, symmetry, authoring metadata, malformed input, and replay exclusion. | A downloaded scenario is inspected, reset, re-imported, and compared in the editor. |
| Mobile layout | Grid resize tests cover supported dimensions. | A 390 × 844 touch viewport verifies announcements and an 8 × 8 board with no horizontal overflow. |
| Keyboard operation | Native button/grid controls retain accessible labels. | Palette selection and cell editing use keyboard activation, with undo/redo announcements. |
| Tournament export | Unit tests cover stable IDs, seeds, tags, all transforms, duplicate detection, versioning, and filenames. | The browser builds, de-duplicates, downloads, and inspects a four-variant tagged set. |

## Verification

- Focused scenario engine, schema, draft API, file-format, practice, tournament,
  and game-route unit suites pass.
- The complete scenario-builder Playwright file passes in headless Chromium,
  including its desktop, touch/mobile, download, import, and practice-launch
  flows.
- TypeScript, focused ESLint, spelling, and diff validation pass.
