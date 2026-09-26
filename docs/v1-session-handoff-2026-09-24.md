# Binary 2048 V1 Session Handoff

Date: 2026-09-26

Status: V1 Stripe-native webhook verification deployed; physical mobile gates remain deferred; V2 implementation frozen until V1 is complete

## Production baseline

- Production feature commit: `f88b8b9` (`fail closed on session lookup errors`);
  Amplify job `316` succeeded.
- Current production application baseline: `3abefa4` (`verify Stripe store
  webhooks`); Amplify job `332` succeeded and `/api/health` reported the
  expected commit.
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

## Latest completed V1 item

The store webhook now uses Stripe's maintained server SDK to verify the exact
raw request body, `Stripe-Signature` header, endpoint signing secret from
`STRIPE_WEBHOOK_SECRET`, and a five-minute timestamp tolerance before parsing
or granting inventory. The former `x-store-webhook-secret` shortcut and
`BINARY2048_STORE_WEBHOOK_SECRET` configuration are not accepted. Missing
configuration returns `503`; missing, stale, or body-mismatched provider
signatures return `400` without granting inventory. Existing event/payment
idempotency remains in place.

Checkout, direct purchase, and real payments remain disabled. Deploying this
verification does not authorize enabling them or adding a production Stripe
endpoint secret without separate approval.

Local verification: focused webhook coverage passed 7/7; the full unit suite
passed 151 suites / 498 tests; typecheck passed; default Playwright passed 52
with the debug-only case skipped; and the production build compiled. Its smoke
wrapper stopped only at the known missing local auth-bridge secret (`503`
rather than the configured environment's unauthenticated `401`).

Commit `3abefa4` deployed through Amplify job `332`. Production health/smoke
passed on the first attempt and production-safe Playwright passed 9/9. An
unsigned production webhook probe returned `503` with `Store webhook is not
configured`, confirming that the handler fails closed and no production Stripe
endpoint secret or payment acceptance was enabled.

## Next V1 task

The next unchecked roadmap entry after the webhook is the fixed-egress Atlas
allowlist reduction, but its own acceptance condition says to perform it only
after the runtime is migrated. Reconfirm that dependency before starting work;
do not treat the current Amplify WEB_COMPUTE runtime as having stable outbound
IP addresses.

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

Desktop sign-out, expired-session handling, and reauthentication recovery are
complete. Save the authenticated Android session-resume flow for the final
physical-device gate.

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

The remaining authenticated acceptance item is the Android Chrome sign-in,
session-resume, gameplay, and sign-out flow. Keep it deferred to the final
physical-device gate.

Desktop lifecycle automation verifies against the real production OAuth state
that sign-out returns protected surfaces to guest messaging and a `401` bridge
response, and that an expired session fails closed while exposing the provider
sign-in recovery path. It also completes a real GitHub OAuth round trip from a
signed-out context using only the ignored local provider session, restores the
authenticated tier, and mints a fresh bridge token. The focused lifecycle run
passed 3/3 and the complete non-destructive authenticated production suite
passed 9/9. No credential, cookie value, token, email address, or account
identifier was printed or committed. The desktop lifecycle roadmap item is
complete; the authenticated parent stays open for the final physical Android
Chrome flow.

Commit `264f1de` deployed through Amplify job `330`. Production health/smoke
passed on the first attempt and the focused lifecycle suite passed 3/3 again
against the deployed commit.

## V2 planning boundary

The user reaffirmed on 2026-09-25 that work remains V1-only until every V1 gate
is complete. Do not start or continue another V2 item. The observability slices
below were already deployed before that boundary was reaffirmed and are retained
as historical production evidence only.

The user explicitly authorized starting V2 on 2026-09-25. The first Phase 0
slice adds bounded, privacy-safe browser performance entries for input capture,
accepted/queued disposition, request start, response headers, response parsing,
React commit, and the following animation frame. Existing queue behavior is
unchanged. Because normal gameplay is still server-gated, traces record
`localEngineStatus: not_run` rather than inventing a client-engine duration.

Focused unit and browser coverage proves accepted keyboard, queued keyboard,
and touch traces through the next painted frame. The second Phase 0 slice adds
queue-depth samples at capture, enqueue, dequeue, and drop plus bounded dropped
input marks classified by every valid directional-input rejection path. It
does not classify non-direction keys or sub-threshold gestures as moves, and
accepted request failures remain execution errors rather than input drops.
Gameplay behavior and the eight-move keyboard buffer are unchanged.

The third Phase 0 slice adds per-attempt UTF-8 request and response body byte
counts, request and response recovery-history lengths, synchronous
local-storage read/write duration, and checkpoint duration across envelope
creation, JSON serialization, and storage. Recovery retry attempts remain
separately tagged. The next V2 item is to add server timing for rate-limit
identity, session lookup, recovery work, engine execution, snapshot signing,
persistence scheduling, and total route time.

For the second slice, 151 unit suites / 494 tests passed, typecheck passed, and
the full local Playwright suite passed 52 with the debug-only case skipped. The
production build compiled successfully; its smoke wrapper stopped at the known
missing local auth-bridge secret (`503` rather than the configured environment's
unauthenticated `401`). The initial sandboxed Playwright attempt could not
launch Chromium because macOS denied its IPC registration; the required
unsandboxed rerun passed completely.

Commit `675ade8` deployed through Amplify job `326`. Production health/smoke
passed on the first attempt and the full production-safe browser suite passed
9/9, including the six-command rapid-input recovery canary. Treat this as the
accepted application baseline for the next Phase 0 slice.

Local verification for the third slice: 151 unit suites / 496 tests passed;
typecheck passed; focused metric unit coverage passed 11/11; focused Chromium
coverage passed 2/2; and the full local Playwright suite passed 52 with the
debug-only case skipped. The production build compiled after replacing an
initial explicit-`any` response type caught by the lint gate. Its smoke wrapper
then stopped only at the known missing local auth-bridge secret (`503` rather
than the configured environment's unauthenticated `401`).

Commit `67026df` deployed through Amplify job `328`. Production health/smoke
passed on the first attempt and the production-safe browser suite passed 9/9,
including rapid input, stale-session recovery, special tiles, guest lifecycle,
and auth/session health. Treat this as the accepted application baseline for
the Server-Timing slice.

The newly added anchored Lock-0 and `Death by Luck` wildcard items remain
research spikes; production tile rules have not changed. The V2 backlog also
includes auditing the existing OpenAPI endpoint and developer page, then
prototyping Swagger UI or an equivalent interactive explorer with complete
contracts and automated drift checks.

Pre-deployment verification for this slice: 151 unit suites / 491 tests passed;
default Playwright passed 51 with the debug-only case skipped; typecheck passed;
and the production build compiled successfully. Its local smoke wrapper stopped
at the known missing local auth-bridge secret (`503` rather than the configured
environment's unauthenticated `401`).

Initial Amplify job `321` deployed the instrumentation commit `ab48e16`, but
the production rapid-input canary exposed a readiness/listener race by
processing 5/6 keys twice. The correction keeps one stable keyboard listener,
waits for New Game readiness in both rapid-input canaries, and strengthens the
local trace regression to six ordered keys plus touch. Commit `52fc75a` deployed
through job `322`; production health/smoke passed on the first attempt and the
full production-safe browser suite passed 9/9, including all six ordered rapid
inputs. Treat job `322`, not job `321`, as the accepted V2 baseline.

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
