# V2 Phase 7 unranked scenario practice evidence

Date: 2026-10-27 America/Boise

Status: complete.

## Launch contract

- The scenario builder launches only after the existing validation contract
  confirms that the authored configuration and board have a legal move.
- Launch sends the exact authored configuration, initial grid, seed, and game
  mode through the normal `POST /api/games` engine API. The request explicitly
  sets `economy.sessionClass` to `unranked` rather than relying on a server
  default.
- The client rejects a launch response if its integrity metadata reports a
  ranked session. Custom practice boards therefore cannot silently enter the
  ranked session path.
- The launched session is stored through the normal resume path. A versioned,
  local practice marker carries the scenario name and game ID to the game view;
  API recovery remaps that marker if recovery creates a replacement session.

## Player experience and leaderboard boundary

- A dedicated Practice game panel explains that scenario practice is always
  unranked and ineligible for ranked leaderboards before the launch button.
- The game view displays `Practice: <name> · Unranked` only when the marker's
  game ID matches the loaded session and the server integrity remains
  unranked. Starting a normal new game clears the marker.
- The screen-reader game summary also identifies the practice scenario and its
  unranked status.
- Existing leaderboard eligibility policy rejects sessions whose integrity is
  not ranked, so these authored sessions remain outside ranked submissions.

## Verification

- Unit tests cover the explicit unranked request, exact scenario cloning,
  source immutability, practice-marker round trips, and invalid marker
  rejection.
- Focused scenario-practice, scenario-builder, and game-route suites pass 22
  unit tests.
- The scenario-builder Playwright suite passes 9 tests. Its launch case
  captures the game request, verifies the explicit unranked class, follows the
  redirect, checks the authored board, checks the visible practice badge, and
  inspects the stored versioned marker.
- A headless Chromium check at 390 × 844 confirms the practice explanation and
  launch control fit the mobile builder with zero horizontal overflow.
- TypeScript, ESLint, spelling, and diff validation pass.
