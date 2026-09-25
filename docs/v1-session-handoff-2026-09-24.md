# Binary 2048 V1 Session Handoff

Date: 2026-09-24

Status: Replay JSON terminal actions implemented and locally verified; deployment pending

## Production baseline

- Current production commit: `1b8e2f1` (`refresh v1 deployment handoff`).
- Amplify job `313` succeeded and `/api/health` reported the expected commit.
- Post-deployment production smoke verification passed on its first attempt.
- Production-safe Playwright: 9/9 passed.
- A targeted production browser check confirmed the Game Log region, Show Log,
  and Copy Log controls are all absent with the default configuration.

## Current V1 behavior

- The New Game overlay directly contains Difficulty, Color, Theme, Mode,
  tutorial-offer preference, and permitted Import/Replay controls.
- There are no player-facing Options buttons. The active mobile dock uses
  `More` only to reveal secondary gameplay actions.
- New Game from active, win, or game-over states opens the shared setup overlay
  without clearing the current board. Tutorial remains directly accessible.
- Game-over and win overlays offer `Replay JSON` whenever replay import is
  permitted by the effective UI policy. The action uses the existing replay
  file picker and accepts keyboard activation.
- Guests receive a cookie-backed tutorial offer after choosing New Game unless
  they opt out. The tutorial success message remains visible for 1700 ms.
- The unavailable store-product legend and developer-style accessibility map
  have been removed from the gameplay page. Concise accessibility guidance
  remains in the User Guide.
- The Game Log is opt-in and entirely absent in the default production
  configuration.

## Completed V1 items

- `NEXT_PUBLIC_GAME_LOG_ENABLED=1` now opts into the debugging Game Log. The
  default/unset value disables the feature.
- Disabled means the client does not render the viewer, accumulate or retain
  diagnostic entries, intercept console/window errors, copy log text, or emit
  diagnostic output. There is no player-facing toggle.
- `.env.example` documents the flag. `npm run test:ui:game-log` launches an
  isolated flag-enabled app for the existing collection/copy regression.
- Game-over and win overlays now expose `Replay JSON` through the existing
  hidden replay-file input. Browser coverage proves keyboard activation, a
  valid JSON import, replay-mode entry, and restoration of each terminal
  overlay after exiting replay.
- Local verification for the Replay JSON item:
  - 149 unit suites / 481 tests passed.
  - Default-config Playwright: 50 passed / 1 flag-enabled case skipped.
  - Typecheck passed.
  - Focused terminal-overlay Playwright: 2/2 passed.

## Next V1 task

The deployed re-review, disposition log, automated evidence, and exact remaining
device checklist are in
[`tutorial-mobile-acceptance-2026-09-24.md`](./tutorial-mobile-acceptance-2026-09-24.md).

The next roadmap item is the physical Android Chrome and iPhone Safari audit in
the acceptance evidence. It must verify thumb reach, swipe/scroll separation,
inline New Game choices, the `More` disclosure, background/resume continuity,
iPhone safe-area padding, and dock layout. This requires real devices; do not
mark the guided-tutorial or real-device roadmap parents complete until both
device passes are recorded.

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
