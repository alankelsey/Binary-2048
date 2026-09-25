# Binary 2048 V1 Session Handoff

Date: 2026-09-24

Status: Game Log configuration item complete locally; ready for review, commit, and deployment

## Production baseline

- Last production commit: `7e62cfd` (`move accessibility guidance out of
  gameplay`).
- Amplify job `311` succeeded and `/api/health` reported the expected commit.
- Post-deployment production smoke verification passed on its second attempt;
  the first hit the known per-instance guest-session miss, then recovery-aware
  production browser coverage passed.
- Production-safe Playwright: 9/9 passed.

## Current V1 behavior

- The New Game overlay directly contains Difficulty, Color, Theme, Mode,
  tutorial-offer preference, and permitted Import/Replay controls.
- There are no player-facing Options buttons. The active mobile dock uses
  `More` only to reveal secondary gameplay actions.
- New Game from active, win, or game-over states opens the shared setup overlay
  without clearing the current board. Tutorial remains directly accessible.
- Guests receive a cookie-backed tutorial offer after choosing New Game unless
  they opt out. The tutorial success message remains visible for 1700 ms.
- The unavailable store-product legend and developer-style accessibility map
  have been removed from the gameplay page. Concise accessibility guidance
  remains in the User Guide.
- Production still has the collapsed Game Log from `7e62cfd`. The completed
  local change described below makes it opt-in and entirely absent by default.

## Completed local V1 item awaiting commit

- `NEXT_PUBLIC_GAME_LOG_ENABLED=1` now opts into the debugging Game Log. The
  default/unset value disables the feature.
- Disabled means the client does not render the viewer, accumulate or retain
  diagnostic entries, intercept console/window errors, copy log text, or emit
  diagnostic output. There is no player-facing toggle.
- `.env.example` documents the flag. `npm run test:ui:game-log` launches an
  isolated flag-enabled app for the existing collection/copy regression.
- Verification after the change:
  - 149 unit suites / 481 tests passed (the count dropped when the obsolete
    accessibility-map helper and its three tests were removed).
  - Default-config Playwright: 50 passed / 1 flag-enabled case skipped.
  - Flag-enabled Game Log Playwright: 1 passed / 1 default-only case skipped.
  - Typecheck passed.
  - `git diff --check` passed.

## Next V1 task

The deployed re-review, disposition log, automated evidence, and exact remaining
device checklist are in
[`tutorial-mobile-acceptance-2026-09-24.md`](./tutorial-mobile-acceptance-2026-09-24.md).

First review, commit, deploy, and production-verify the completed Game Log flag
item. The next implementation item in roadmap order is to add `Replay JSON` to
the game-over and win overlays through the existing hidden replay-file input,
with keyboard and Playwright coverage. Keep active-board and terminal New Game
routing unchanged.

After the player-facing cleanup parent is complete, execute the recorded
physical Android Chrome and iPhone Safari checklist. Do not mark the guided-
tutorial or real-device roadmap parents complete until both device passes are
recorded.

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
