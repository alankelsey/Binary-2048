# Binary 2048 V1 Session Handoff

Date: 2026-09-24

Status: ready for a fresh implementation session

## Production baseline

- Last behavior-changing production commit: `7e15eb4` (`extend tutorial
  success feedback`).
- Amplify job `306` succeeded.
- Post-deployment production smoke verification passed.
- Last full local verification: 150 unit suites / 484 tests and 47 Playwright
  UI tests passed.

## Current V1 behavior

- The New Game overlay directly contains Difficulty, Color, Theme, Mode,
  tutorial-offer preference, and permitted Import/Replay controls.
- There are no player-facing Options buttons. The active mobile dock uses
  `More` only to reveal secondary gameplay actions.
- New Game from active, win, or game-over states opens the shared setup overlay
  without clearing the current board. Tutorial remains directly accessible.
- Guests receive a cookie-backed tutorial offer after choosing New Game unless
  they opt out. The tutorial success message remains visible for 1700 ms.
- The Game Log is collapsed by default.

## Next V1 task

Complete the tutorial/mobile acceptance gate:

1. Run a frontend-design re-review against the deployed flow and record any
   accepted, modified, or declined follow-up findings.
2. Perform the full flow on Android Chrome: inline New Game choices, tutorial
   offer preference, every lesson, quit/completion, active-game preservation,
   `More`, rapid swipes, and background/resume continuity.
3. Repeat critical layout, safe-area, swipe, and dock checks on iPhone Safari.
4. Record evidence and only then mark the guided-tutorial and real-device
   roadmap parents complete.

After that gate, finish authenticated V1 acceptance: protected data deletion,
sign-out/expired-session/reauthentication recovery, and the authenticated
Android session-resume flow.

## Working-tree caution

The following performance reports are intentionally untracked and must not be
staged, committed, deleted, or rewritten unless the user explicitly requests
performance-plan work:

- `docs/performance-analysis-2026-09-17.md`
- `docs/performance-improvement-report-2026-09-17.md`
- `docs/performance_research.md`

Use `docs/roadmap-checklist.md` as the completion source of truth. Do not start
Binary 2048 v2 implementation while completing the V1 acceptance work.
