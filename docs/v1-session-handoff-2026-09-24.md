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

## V2 evidence preserved

The performance evidence needed for later V2 work is tracked in:

- `docs/performance_research.md` — sanitized source discussion and production
  guest-game trace; the game ID is anonymized as `g_perf_sample`.
- `docs/performance-analysis-2026-09-17.md` — measured latency analysis.
- `docs/performance-improvement-report-2026-09-17.md` — independent code-path
  review and prioritized recommendations.
- `docs/binary2048v2.md` — consolidated plan, including discrepancies and
  claims that must be proven before implementation.

These reports contain no credentials or authenticated browser state. Preserve
the benchmark ledgers, challenge corpus, V1 behavior contracts, and Mongo
planning when V2 begins. Never commit `.env` files, authentication storage
state, cookies, access tokens, or local build output.

Use `docs/roadmap-checklist.md` as the completion source of truth. Do not start
Binary 2048 v2 implementation while completing the V1 acceptance work unless
the user explicitly changes scope.
