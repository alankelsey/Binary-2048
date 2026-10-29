# V2 Phase 7 dedicated scenario-builder view evidence

Date: 2026-10-27 America/Boise

Status: complete.

## View contract

- `/scenario-builder` is a dedicated, metadata-bearing public route with its
  own canonical URL and a direct path back to the game.
- A fresh visit starts with an empty 4 × 4 board and exposes controls for rows,
  columns, seed, win tile, all spawn probabilities, wildcard multipliers, game
  mode, the current annihilate zero behavior, and spawn-after-no-op behavior.
- Existing boards reopen through named local or private account drafts and
  versioned scenario JSON imports. Both paths restore configuration and board
  state into the same editor.

## Discoverability

- The game links to Scenario Builder from its game-tools navigation.
- Development navigation includes the route for local workflows.
- The public sitemap includes `/scenario-builder`.

## Verification

- Playwright verifies the dedicated heading, empty board, required default
  controls, and game navigation. The broader scenario-builder browser suite
  verifies existing-board restoration through drafts and JSON import.
- Sitemap unit coverage verifies the public route.
- TypeScript, focused ESLint, spelling, and diff validation pass.
