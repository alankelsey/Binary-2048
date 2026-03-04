# Binary-2048 User Guide

## Quick Start

1. Open the app home page.
2. Start a run with `New Game`.
3. Move tiles with:
   - Arrow keys
   - `W/A/S/D`
   - Swipe on mobile

## Core Rules

- Number tiles merge when equal (`1+1=2`, `2+2=4`, ...).
- `0` is an annihilator:
  - `0` with any tile removes or cancels according to current rule behavior.
- Wildcard tile (`✦`) boosts number tile merges by multiplier.
- Lock-0 tile (`⛓`) resists destruction on one turn, then behaves like `0`.

## Modes and Settings

- `Classic`: standard empty-start gameplay.
- `Bitstorm`: seeded challenge board with prefilled tiles.
- Difficulty presets affect wildcard/lock spawn balance.
- Color and theme options are in `Options` when available.

## Replay and Sharing

- `Export JSON`: save the current run.
- `Replay JSON`: load a replay/export file and step through moves.
- Replay controls support:
  - Timeline scrubber
  - Play/pause
  - Speed 1-10
- `Copy Replay Link` creates shareable replay links.

## Ranked vs Unranked

- Ranked sessions use stricter server validation paths.
- Some actions/features can be disabled in ranked contexts.
- Leaderboard submission accepts only eligible finished ranked runs.

## Accessibility

- Keyboard + tab navigation supported.
- Skip link is available at page top.
- In-app accessibility section documents current shortcut map and tab order.

## Troubleshooting

- If game state looks stale, start `New Game`.
- If replay import fails, verify file is a valid export/replay payload.
- For API and developer integration details, see `docs/developer-guide.md`.
