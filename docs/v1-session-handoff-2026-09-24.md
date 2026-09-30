# Binary 2048 V1 Session Handoff

Date: 2026-09-29

Status: V1 shared leaderboard persistence and shared production bot quotas are active and production-accepted on Mongo; mobile acceptance, fixed egress, and remaining merch work moved to the end of V2; V2 implementation otherwise frozen until V1 is complete

## Production baseline

- Current application baseline: `82c46c5` (`restore Amplify admin authority
  environment`); GitHub CI and Amplify Deploy Watch passed, and Amplify job
  `363` deployed the commit.
- Production uses `BINARY2048_LEADERBOARD_STORE=mongo` with the rotated Atlas
  application credential and the approved protected-acceptance admin token.
- Post-cold-start production smoke verification passed.
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
- Game-over and win overlays offer `Export JSON` whenever game export is
  permitted by the effective UI policy. The action uses the existing
  recovery-aware download flow and remains keyboard accessible.
- Guests receive a cookie-backed tutorial offer after choosing New Game unless
  they opt out. The tutorial success message remains visible for 1700 ms.
- The unavailable store-product legend and developer-style accessibility map
  have been removed from the gameplay page. Concise accessibility guidance
  remains in the User Guide.
- The Game Log is opt-in and entirely absent in the default production
  configuration.

## Completed V1 item — shared leaderboard persistence

Ranked leaderboard storage now has explicit asynchronous memory and Mongo
backends. Mongo mode uses deterministic upserts, preserves the original
submission timestamp on retries, creates unique/filter-sort/player indexes,
and fails closed rather than silently falling back to per-instance memory.
Leaderboard reads, submissions, account export, and protected deletion await
the shared store. The protected storage-health route performs a temporary
leaderboard write/read/delete round trip for production acceptance.

Two confirmed defects were fixed: ranks beyond the prior top-20 lookup window
are now calculated against the complete matching board, and equal entries use
their stable ID as the final sort tie-breaker. The server-rendered leaderboard
shows an unavailable state instead of misreporting a storage outage as an empty
leaderboard.

Local verification: focused persistence/API/privacy/UI coverage passed
35/35; the full unit suite passed 151 suites / 505 tests; typecheck passed; and
default Playwright passed 52 with the debug-only case skipped. The production
build compiled; its smoke wrapper stopped only at the known missing local
auth-bridge secret (`503` rather than the configured environment's
unauthenticated `401`).

Commits `a139ac0` and `2dde345` deployed the adapter and bounded Mongo failure
handling. Job `336` deployed the first Mongo activation, where the public
leaderboard read timed out as a CloudFront `504`. Job `337` restored memory
mode and the endpoint recovered to `200`. Job `338` deployed a five-second
Mongo server-selection bound; job `339` retried Mongo mode and returned the
intended sanitized `503`, confirming persistent connectivity failure rather
than a usable shared store. Job `340` restored memory mode. Production smoke
then passed on its first attempt, `/api/leaderboard` returned `200`, and health
reported commit `2dde345`. The production browser suite passed all nine tests,
with one auth-page navigation requiring its configured retry during the first
rollout.

Commit `f7e7e9d` added PII-free Mongo initialization classification, cleared a
failed cached initialization so a warm instance can retry, and stopped the
storage rollout script from printing its admin token. Unit coverage proves a
transient initialization failure logs only error name/code and reconnects on
the next request. Amplify job `342` deployed this safely in memory mode.

The Atlas application credential was rotated, the new URI was stored directly
in Amplify without exposing it, and job `343` loaded it. Atlas network access
was expanded to the documented temporary broad rule required by Amplify
`WEB_COMPUTE`; fixed egress and allowlist restriction remain end-of-V2 work.
Job `344` enabled `BINARY2048_LEADERBOARD_STORE=mongo`. The public leaderboard
returned `200`, initialized its indexes, and emitted no classified Mongo
failure. Production smoke passed.

With explicit approval, job `345` provisioned the protected-acceptance admin
token without printing it. The guarded storage check proved Mongo leaderboard
write/read/delete and removed exactly one temporary entry. Commit `1172b19`
added a strict admin-only phased practice probe. Focused tests passed 12/12,
the full unit suite passed 152 suites / 509 tests, and typecheck passed.
Job `346` deployed the probe. A pre-deploy runtime wrote one isolated practice
entry, job `347` forced a cold start, the replacement runtime read the same
entry from Mongo, and cleanup deleted it. Final production smoke passed and
production-safe Playwright passed 9/9. The shared-persistence parent and both
children are therefore complete.

On 2026-09-28 the user confirmed deletion of the obsolete Atlas application
user after the rotated credential had passed production acceptance. The active
least-privilege application user remains in service.

## Completed V1 item — shared production bot quotas

Production already had one bot-key hash, `BINARY2048_RATE_LIMIT_STORE=mongo`,
the `rate_limits` collection, and its TTL index. No Mongo fallback events were
present after Atlas connectivity was repaired. Commit `c992717` added an
admin-and-bot-key-protected acceptance probe with a run-specific short-lived
counter bucket and opaque per-runtime IDs. It exposes no API key, internal
counter key, IP address, hostname, or infrastructure identifier.

Focused probe/rate-limit coverage passed 14/14, the full unit suite passed 153
suites / 514 tests, typecheck passed, and the production build compiled. Its
local wrapper stopped only at the known missing local auth-bridge secret.
Amplify job `349` deployed the probe.

For production acceptance, a raw ephemeral bot key existed only inside the
guarded shell process; only its hash was temporarily appended in Amplify. Job
`350` loaded it. Twenty-four simultaneous protected requests were served by 24
distinct runtime IDs; all 24 reported the Mongo backend and validated API-key
scope, and all returned unique consecutive counter values with a span of 23.
This proves separate production compute instances atomically consumed one
shared Mongo counter. Job `351` restored the original key configuration; a
sanitized check confirmed exactly one production bot-key hash remained.
Production smoke passed and production-safe Playwright passed 9/9. The parent
and final multi-instance child are complete.

## Completed V1 items

- Game-over and win overlays expose a distinct `Export JSON` action through
  the existing recovery-aware game export endpoint. It is policy-controlled,
  remains visible but disabled while another game action is busy, and does not
  replace the separate `Replay JSON` import action.
- Static overlay coverage proves both terminal states render the action.
  Focused Playwright passed 2/2 and proves keyboard activation, recovery
  snapshot submission, server-provided filenames, successful downloads, and
  preservation of the terminal flows for both Game Over and You Win. Full unit
  verification passed 153 suites / 514 tests; typecheck passed. Full local
  Playwright passed the new tests and 49 other active cases, with one unrelated
  move-performance timing assertion passing immediately on focused rerun; the
  debug-only Game Log case remained intentionally skipped.
- GitHub CI passed typecheck, the full unit suite, and its production build
  smoke. Amplify job `353` succeeded, the GitHub deploy-watch verification gate
  passed, production smoke passed, and production-safe Playwright passed 9/9,
  including the deployed Game Over `Export JSON` visibility assertion.

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

## Previous completed V1 item — auth lifecycle

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

## V1 scope update — 2026-09-27

At the user's direction, the remaining mobile acceptance gate, fixed-egress
migration/Atlas allowlist reduction, and merch/swag evaluation and design were
moved to the end of V2. This is a scope transfer, not acceptance evidence:
physical Android Chrome and iPhone Safari behavior remains unverified, and no
fixed-egress infrastructure or additional recurring cost was provisioned.

The completed tutorial implementation, deployed frontend-design disposition,
automated mobile audit, and desktop/authenticated production acceptance now
close their V1 parents under the revised scope. Their historical evidence is
preserved in this handoff and in
[`tutorial-mobile-acceptance-2026-09-24.md`](./tutorial-mobile-acceptance-2026-09-24.md).

## Next V1 task

Use `docs/roadmap-checklist.md` as the completion source of truth. The
shared leaderboard implementation, production activation, protected round
trip, and post-cold-start visibility acceptance are complete.

On 2026-09-29 the user directed that any remaining work with infrastructure or
usage cost be completed last. A read-only AWS audit found only the production
`main` Amplify branch and its production WAF ACL; `docs/dev-environment.md` is a
blueprint, not a deployed environment. The roadmap was corrected and the dev/
WAF test infrastructure, dedicated worker runtime, transactional inventory
persistence, and Mongo session activation were moved to the final cost-gated
V1 section. Do not provision any of them without explicit cost approval.

The multi-step dense-board research gate is complete locally. The
`asymmetric-edge-choice` scenario is now version 2 and uses an exhaustive
four-move objective: every legal deterministic sequence is ranked by completed
moves, preservation of the top-left 128 anchor, empty cells, then score. The
tied optima are `DLRU` and `RUDL`; benchmark credit now requires a complete
non-fallback match instead of checking only the first action. Corpus validation
recomputes and locks those optima, regression coverage rejects a truncated
contract, and the no-cost report regeneration re-scored all 24 stored traces.
No aggregate pass counts changed; the dense-board rows now display complete
selected and expected sequences. Focused corpus tests (5/5), benchmark-library
tests (7/7), the full unit suite (153 suites / 516 tests), and typecheck passed.
The production build compiled; its smoke wrapper stopped only at the known
missing local auth-bridge secret (`503` rather than the configured
environment's unauthenticated `401`).
Commit `222169b` passed GitHub CI and deployed through Amplify job `355`.
Post-deploy production verification, service-role SSM access, and release
auth/session verification all passed.

Leaderboard pagination plus current-player rank/highlighting is complete
locally. Ranked reads now return bounded page entries, total entries, total
pages, and a clamped page number. Mongo uses filtered `skip`/`limit` reads and
computes the signed-in player's best rank with the same score, max-tile, moves,
submission-time, and ID tie-breakers as the displayed board. Later pages keep
absolute ranks; the signed-in row is highlighted and labeled `You`, while a
summary reports when the player's best entry is outside the current page. The
OpenAPI query contract now includes `page` and the existing 1-100 `limit`
bound.

Focused leaderboard/API/render/OpenAPI coverage passed 22/22 before the Mongo
paging regression was added; the full unit suite then passed 153 suites / 519
tests, including the bounded Mongo page and current-player rank query. Typecheck
passed. The production build compiled; its local smoke wrapper stopped only at
the known missing auth-bridge secret. A sandboxed focused Playwright attempt
could not launch Chromium because macOS denied its IPC registration. The
required unsandboxed rerun passed 7/8; populated ranked/daily layout, narrow
scrolling, tabs, preview state, and keyboard focus passed. The remaining
empty-ranked assertion reached the correct fail-closed unavailable state
because the pre-existing local dev server was configured for an unreachable
Mongo store, so no empty-memory claim is made from that run.
Commit `9bbce51` passed GitHub CI and deployed through Amplify job `357`.
Post-deploy production verification, service-role SSM access, and release
auth/session verification passed. A read-only production request with
`limit=1&page=2` returned the new pagination contract and correctly clamped the
empty board to page 1. The standard production-safe Playwright suite passed
9/9 after deployment.

The production-operations authority prerequisite is complete and deployed. All
existing admin routes now delegate to one fail-closed server module. Automation
retains the existing high-entropy `BINARY2048_ADMIN_TOKEN`, compared through
fixed-length digests with a timing-safe primitive. Named operators must present
a valid, unexpired auth-bridge bearer token whose exact subject is separately
listed in the server-only `BINARY2048_ADMIN_SUBJECTS` allowlist. Guest,
authenticated, and paid tiers, entitlements, spoofed subject headers, and
`NEXT_PUBLIC_UI_ADMIN_MODE` grant no authority. Missing configuration fails
closed. The contract and rotation/revocation rules are documented in
`docs/admin-authority.md`.

Focused centralized-authority and migrated-route coverage passed 23/23;
typecheck passed; and the full unit suite passed 154 suites / 524 tests. The
production build compiled, with its smoke wrapper stopping only at the known
missing local auth-bridge secret (`503` rather than the configured
environment's unauthenticated `401`). Production does not need an operator
subject configured to preserve the existing service-automation path; no
allowlist value has been added or inferred.

Commit `b8ca42a` passed GitHub CI and deployed through Amplify job `359`.
Post-deploy production verification, service-role SSM access, and release
auth/session verification passed. Production-safe Playwright passed 9/9. A
direct unauthenticated request to `/api/ops/league/config` returned the
expected generic `401 Admin authorization required`, while the deploy gate's
existing service-token checks continued to pass.

The authorized, read-only operations API work covers telemetry, passive storage
status, league configuration, leaderboard operations, and model-registry data.
Active storage smoke writes must remain separate from passive reads. Do not
begin V2 work.

That read-only API work is now partially complete locally. The previously
public telemetry snapshot requires centralized admin authority and identifies
itself as runtime-scoped. New authorized `no-store` reads cover passive storage
configuration status, bounded leaderboard operations data, and sanitized model
registry data; the existing league read now also declares its runtime scope.
Production leaderboard reads identify Mongo as shared. Arbitrary model metadata
is not returned.

The former mutating `GET /api/ops/storage/health` was renamed to the explicit
`POST /api/ops/storage/smoke`, and the production verification script follows
the new route. `GET /api/ops/storage/status` performs no connection attempt or
write. Focused ops/OpenAPI/docs coverage passed 13 suites / 36 tests. The full
unit suite passed 157 suites / 532 tests, typecheck passed, and the production
build compiled. Its local smoke wrapper stopped only at the known missing local
auth-bridge secret (`503` rather than the configured environment's
unauthenticated `401`).

Do not mark the shared-ops-API parent complete yet. Telemetry, league
configuration, and the model registry remain process-local and are labeled as
such. Making them fleet-consistent would add Mongo writes or metered monitoring
queries, so that final aggregation is now in the cost-gated V1 tail per the
user's direction. The leaderboard source is already shared in production.

The first deployment of this slice exposed a cache-safety defect during
acceptance: after anonymous 401 checks, authenticated reads received the same
CloudFront error response. Every centralized-admin route now marks its generic
401 as `Cache-Control: no-store`; focused coverage asserts this for telemetry,
storage status/smoke, league, leaderboard, models, quota/leaderboard probes,
and inventory grants. Re-run production acceptance after the corrective
deployment and record only the observed result.

The cache-control correction alone did not restore authorized production
reads: an uncached invalid inventory-grant `POST` also returned 401 with the
stored service token. The confirmed deployment cause is that Amplify does not
forward build variables to the SSR runtime, while the new authority helper read
the generic `process.env` object. The fix uses direct property references for
both `BINARY2048_ADMIN_TOKEN` and `BINARY2048_ADMIN_SUBJECTS` and adds the
allowlist to `next.config.mjs` beside the token. Focused authority/ops/inventory
coverage passes 10 suites / 30 tests and typecheck passes. Production acceptance
proved all five passive/read endpoints return 200 with the existing service
token. An anonymous storage-status request returned 401 with
`Cache-Control: no-store`, and an immediate authorized request to the same URL
returned 200, closing the cache-poisoning regression. GitHub CI and the Amplify
deploy watch passed for commits `e6cf452`, `8781be9`, and `82c46c5`; the final
correction deployed through Amplify job `363`. Production-safe Playwright
passed 9/9. No active production storage write probe was run for this read-only
acceptance.

After this slice is deployed, the next non-cost V1 workstream is the public
research-release audit and dataset documentation in the existing public
`alankelsey/Binary-2048` repository.

That audit started on 2026-09-29. The earlier `botvsbot/binary2048` roadmap
reference was traced to an unsupported planning assumption in commit
`73c2a6b`; it is not a repository or required release target. GitHub confirms
the actual `alankelsey/Binary-2048` repository is already public, so its tracked
dataset files and history must be treated as already exposed. V1 will use the
existing repository; V2 will revisit whether a dataset-only repository adds
enough value. The local canonical model export was inventoried: its eight JSONL/Parquet hashes
match the checked-in manifest, and a targeted scan of the JSONL sources found
no obvious credential or player-identity fields. This is preliminary evidence,
not release approval. `npm run research:release:audit` now locks the manifest
hashes and row counts and scans every canonical JSONL row in CI. The ignored
archive contains an ineligible pickle replay buffer and internal handoff.
Continue from
[`research-release-audit-2026-09-29.md`](./research-release-audit-2026-09-29.md)
and audit the existing public exposure before creating an immutable release.

V2 now includes a 30-day itemized hosting-cost reassessment. It must test the
working hypothesis that Atlas/MongoDB is the primary cost driver and compare
measured total cost of ownership—not web-hosting sticker price alone—before
any Amplify-to-VPS or Lightsail migration is proposed.

The tutorial/mobile parents and authenticated acceptance parent are complete
for the revised V1 scope. The physical-device checks and fixed-egress work are
now end-of-V2 items. Do not treat Amplify `WEB_COMPUTE` as having stable
outbound IP addresses, and do not provision fixed-egress infrastructure while
finishing V1.

The deployed re-review, disposition log, automated evidence, and exact remaining
device checklist are in
[`tutorial-mobile-acceptance-2026-09-24.md`](./tutorial-mobile-acceptance-2026-09-24.md).

Physical Android Chrome and iPhone Safari acceptance is now deferred to the end
of V2. The exact checklist remains in the acceptance evidence; do not represent
emulation results as physical-device proof.

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

The Android Chrome sign-in, session-resume, gameplay, and sign-out flow is now
part of the end-of-V2 physical-device gate.

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

Historical context: the user briefly authorized starting V2 on 2026-09-25
before restoring the V1-only boundary. The first completed Phase 0 slice added
bounded, privacy-safe browser performance entries for input capture,
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

The third completed Phase 0 slice added per-attempt UTF-8 request and response body byte
counts, request and response recovery-history lengths, synchronous
local-storage read/write duration, and checkpoint duration across envelope
creation, JSON serialization, and storage. Recovery retry attempts remain
separately tagged. At the freeze point, the next planned Phase 0 work was server
timing for rate-limit identity, session lookup, recovery work, engine execution,
snapshot signing, persistence scheduling, and total route time. Do not start it
until every V1 gate is complete or the user explicitly changes scope.

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
historical accepted baseline for the following Phase 0 slice.

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
and auth/session health. This is the historical accepted V2 baseline at the
freeze point; it is not the current production baseline and does not authorize
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
