# V2 Phase 7 deterministic move-preview evidence

Date: 2026-10-27 America/Boise

Status: complete.

## Implementation

- The scenario builder derives one preview for every legal direction by calling
  the same `applyMove` engine function used by gameplay and API simulation.
- Each preview starts from the authored seed with RNG step zero and displays the
  complete resulting board after movement, merges, special-tile behavior, and
  the deterministic spawn.
- Preview summaries report score gained plus the spawned tile and coordinate.
  Invalid scenarios show validation guidance instead of speculative results.
- Result boards use semantic grids and grid cells with row, column, and tile
  labels. A polite status reports the number of available legal previews.
- Previews render below the editable board. This placement keeps the authoring
  grid stationary when the first tile makes a scenario valid, preserving mouse
  and touch painting gestures.
- The responsive card layout uses two columns where space permits and one column
  on narrow mobile screens. Empty preview cells are visually blank but retain
  their accessible `Empty` labels.

## Verification

- The scenario-builder unit suite passes 9 tests, including repeatable previews,
  legal-direction filtering, deterministic spawn events, RNG advancement, and
  source-grid immutability.
- The focused Playwright suite passes 6 tests. It covers semantic 4 × 4 result
  boards for both legal directions, validation suppression, pointer painting,
  touch painting, keyboard operation, and screen-reader announcements.
- A 390 × 844 mobile viewport capture was inspected. The editable board remains
  ahead of the previews, preview cards do not overflow horizontally, and each
  resulting board remains legible in a single-column layout.
