# Binary 2048 V1 Session Handoff

Date: 2026-09-25

Status: Protected production data-deletion acceptance complete; sign-out/session recovery is next

## Production baseline

- Production feature commit: `f88b8b9` (`fail closed on session lookup errors`);
  Amplify job `316` succeeded.
- Current deployed main: `b477040` (`record deletion harness deployment`);
  Amplify job `319` succeeded and `/api/health` reported the expected commit.
- Post-deployment production smoke verification passed on its first attempt.
- Production-safe Playwright: 9/9 passed.
- A targeted production browser check reached Game Over and confirmed the
  deployed `Replay JSON` action is visible. Earlier targeted production
  evidence also confirms the Game Log is absent with the default configuration.

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
  - Post-deploy smoke passed on its first attempt; production-safe Playwright
    passed 9/9; focused deployed Game Over assertion passed 1/1.

## Latest completed V1 item

- Auth-aware read-only pages now use a shared optional session lookup that logs
  PII-free failure metadata before falling back to guest state.
- Protected auth-bridge token creation uses a required lookup: a confirmed
  missing session remains `401`, while session-service failure returns `503`
  and never silently downgrades.
- Verification:
  - Focused helper and route coverage: 2 suites / 8 tests passed.
  - Full unit suite: 150 suites / 486 tests passed.
  - Default-config Playwright: 50 passed / 1 debug-flag case skipped.
  - Typecheck passed; production compilation succeeded.
  - The local build smoke wrapper reached its known environment-only stop: no
    auth-bridge secret is configured locally, so the bridge endpoint returns
    `503` instead of the configured environment's unauthenticated `401`.
  - `git diff --check` passed.
  - Amplify job `316` succeeded; production health and smoke passed on the
    first attempt; production-safe Playwright passed 9/9, including the auth
    page and browser-context auth/session API health checks.

## Next V1 task

The deployed re-review, disposition log, automated evidence, and exact remaining
device checklist are in
[`tutorial-mobile-acceptance-2026-09-24.md`](./tutorial-mobile-acceptance-2026-09-24.md).

Physical Android Chrome and iPhone Safari acceptance is intentionally deferred
to the final V1 gate. The exact checklist remains in the acceptance evidence;
do not close either physical-device parent from emulation results.

The iPhone-emulation audit found that the current Playwright mobile coverage is
Chromium-only. A supplemental Playwright WebKit/iPhone lane can cover WebKit
compatibility, layout, and synthetic touch after its browser binary is
installed. Full Mobile Safari simulation additionally requires Xcode and an
iOS Simulator runtime, neither of which is installed. These are supplemental
checks and cannot prove physical touch, safe areas, browser suspension,
VoiceOver, latency, or thumb reach.

Continue authenticated V1 acceptance with sign-out, expired-session handling,
and reauthentication recovery. Save the authenticated Android session-resume
flow for the final physical-device gate.

The deletion item is complete. Route coverage proves rejection of
unauthenticated, tampered, and expired credentials and proves deleting account
A preserves account B's inventory, ledger, subscriptions, and leaderboard
entries. A separate `npm run ops:auth:acceptance:delete` harness is fail-closed
unless all of the following are supplied deliberately: the exact destructive
confirmation phrase, the production URL, the dedicated deletion-test storage
state path, and the SHA-256 of the disposable account identity. The config
rechecks every guard and validates the active session identity before issuing
`DELETE`, then requires an empty protected export. On 2026-09-25 the harness
was run with explicit approval against a dedicated disposable OAuth account;
its identity hash matched, deletion succeeded, and the subsequent protected
export was empty (1/1 Playwright acceptance passed). No account identity,
cookie, token, or storage state was committed or logged. Full unit verification
is 150 suites / 487 tests; typecheck passed; the unguarded command correctly
refused to start.
Amplify job `318` deployed the guarded harness/test commit; production health
and smoke passed on the first attempt.

Next, verify sign-out, expired-session handling, and reauthentication recovery
on desktop. Keep the authenticated Android session-resume flow deferred to the
final physical-device gate.

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
