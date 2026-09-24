# Binary-2048 Roadmap Checklist

This file is the source of truth for roadmap completion tracking.
Run `npm run roadmap:status` to calculate progress from these checkboxes.

## Core Engine + API

- [x] Deterministic RNG (`seed + rngStep`) in gameplay engine
- [x] Export includes replay-critical metadata (`rulesetId`, `engineVersion`, `spawnProbs`)
- [x] `POST /api/replay` deterministic reconstruction endpoint
- [x] Replay code encode/decode endpoint (`/api/replay/code`)
- [x] Replay code signing + tamper detection
- [x] Replay code compression fallback (`r1z.`)
- [x] Encoded AI state endpoint (`GET /api/games/:id/encoded`)
- [x] Batch simulation endpoint (`POST /api/simulate`)
- [x] Canonical replay endpoint (`GET /api/games/:id/replay`)
- [x] Compact production export mode (`header + moves` only)
- [x] Replay checksum chain per step for audit mode

## Replay Hardening

- [x] Canonical replay flow: seed + moves deterministically reconstructs final state
- [x] Shareable replay links via encoded replay payload (`/replay?code=...`)
- [x] Add hosted replay permalink/hash ids so shared replays can survive live session expiry and cold starts
- [x] Ranked leaderboard is server-authoritative (does not trust client-submitted scores/replays)
- [x] Move endpoint optimistic concurrency guard (`stateHash` + `409` on stale clients)
- [x] Replay header schema lock: include explicit `replayVersion`, `size`, `createdAt`, and compatibility checks
- [x] Step log schema lock: include `rngStep`, `scoreDelta`, `scoreTotal`, and normalized event payloads
- [x] RNG draw contract tests: enforce fixed draw count per spawn (type draw + position draw)
- [x] `validateReplay(header,moves)` API/utility with compatibility and deterministic rerun checks
- [x] Signed replay tokens for ranked submissions (HMAC on replay payload; reject tampered metadata/moves)
- [x] Replay URL oversize fallback: short-lived signed server-hosted replay when encoded URL exceeds safe length
- [x] Engine version pinning strategy for tournaments/replays across version upgrades
- [x] Replay storage strategy doc: no-DB default + Mongo migration model for top scores/contests

## Gameplay UX

- [x] Swipe + Arrow + WASD movement support
- [x] Undo limits by difficulty
- [x] Active-run control visibility policy
- [x] Win overlay with Continue/New Game actions
- [x] Replay step-through viewer
- [x] Replay autoplay controls (play/pause/speed)
- [x] Mode support (`Classic`, `Bitstorm`)
- [x] Theme persistence + dropdown
- [x] Accessibility pass for full tab/keyboard navigation map
- [x] Explicit replay timeline scrubber UI
- [x] Add subtract-tile mechanic design spike (rules, readability, anti-chaos limits, ranked eligibility decision)
- [x] Add board-flip mechanic prototype (horizontal/vertical/inversion triggers with accessibility review)
- [x] Add device tilt control experiment for mobile with opt-in toggle, calibration, and conflict rules vs swipe
- [x] Add motion-safety policy for flip/tilt mechanics (`prefers-reduced-motion`, disable in ranked by default)
- [x] Add mobile control safety pass so bottom action buttons are harder to hit accidentally during swipe play
- [x] Add destructive-action confirmation or safer placement for `New Game` on small screens during active runs
- [x] Add explicit session resume fix for mobile background/lockscreen/browser restore so active games do not silently reset
- [x] Add resume telemetry for `session_resume_success`, `session_resume_miss`, and `session_reset_after_resume`
- [x] Prefer the browser recovery snapshot during casual-game startup so refresh does not depend on Amplify instance-local session memory
- [x] Make guest moves and undo recover atomically from compact browser snapshots when Amplify routes a request to a different instance
- [x] Add a deterministic Playwright Death-by-AI Bitstorm game-over regression for the manual left/down, right/left testing loop
- [x] Add engine collision-matrix and Playwright interaction coverage for zero, wildcard, and lock special tiles
- [x] Serialize rapid keyboard moves through a bounded client buffer so overlapping API requests cannot race recovered game ids
- [x] Require an explicit `Start New Game` action when no recoverable game exists instead of generating a board on page load
- [ ] Design and ship the guided new-player tutorial ([design plan](./tutorial-design-plan.md))
  - [x] Prompt first-time players to start the tutorial, with clear `Start Tutorial` and `Not Now` actions and no automatic board generation
  - [x] Keep a persistent, accessible `Tutorial` launcher available after dismissal or completion
  - [x] Require confirmation before launching from an active game; accepting must end that run and must not preserve it as resumable gameplay
  - [x] Allow the tutorial to be cancelled at any step; both cancellation and completion must return the player to the explicit `Start New Game` state
  - [x] Use deterministic, authored boards to teach all four move directions and every tile type: number, zero, wildcard, and Lock-0
  - [x] End with guided merge-chain steps that visibly build to the `2048` tile, then show a completion summary
  - [x] Implement the [2026-09-20 tutorial improvement plan](./tutorial-improvement-plan-2026-09-20.md): inline New Game choices, persistent Tutorial access, opt-out cookie, coach overlays, directional animation, and automatic progression
  - [x] Apply and disposition the [frontend review](./tutorial-frontend-review-2026-09-20.md), including mobile fit, dialog modality, teaching cues, special-tile labels, and completion emphasis
  - [x] Add unit and Playwright coverage for prompt persistence, active-game confirmation, deterministic steps, invalid input, cancellation, completion, mobile layout, keyboard use, and reduced motion
  - [ ] Run a frontend-design review after the functional prototype is complete, incorporate or explicitly disposition its feedback, and perform final Android Chrome and iPhone Safari checks
    - [x] Re-review and disposition the deployed tutorial/New Game flow; rerun automated acceptance and record results ([evidence](./tutorial-mobile-acceptance-2026-09-24.md))
    - [ ] Complete the physical Android Chrome and iPhone Safari checklist in the acceptance evidence
- [x] Consolidate pre-game choices into the New Game overlay
  - [x] Remove player-facing `Options` buttons and render Difficulty, Color, Theme, Mode, tutorial preference, and permitted Import/Replay actions below New Game and Tutorial
  - [x] Route active, win, and game-over New Game actions through the same setup overlay without clearing the current board before confirmation
  - [x] Rename the mobile secondary-action disclosure to `More`; retain `aria-expanded`/`aria-controls` and keep Tutorial/export/replay reachable during play
  - [x] Add Playwright coverage for inline choices, absence of duplicate Options buttons, active-board preservation, terminal routing, and 390px/412px mobile controls
- [x] Complete the mobile action-dock accessibility follow-up
  - [x] Add Playwright coverage proving primary controls remain visible, secondary controls toggle through `More`, and the dock stays on one row at 390px and 412px
  - [x] Verify long labels such as `Confirm New Game` do not enlarge the fixed dock enough to cover the board or final page content
  - [x] Replace the `title`-only difficulty help with a keyboard- and touch-accessible visible disclosure
  - [x] Confirm primary and secondary control targets, focus states, and reduced-motion behavior without weakening the active-run New Game confirmation
- [ ] Complete player-facing help and terminal-action cleanup
  - [x] Remove the unavailable store-product icon legend from How to Play while retaining the actual tile rules and add regression coverage
  - [ ] Remove the developer-style keyboard shortcut/tab-order disclosure from the gameplay page while preserving accessible behavior and concise user documentation
  - [ ] Add `Replay JSON` to the game-over and win overlays through the existing replay-file flow, with keyboard and Playwright coverage
- [ ] Run and document a real-device mobile UX audit after the action-dock and resume fixes
  - [x] Rerun automated mobile viewport, dock, swipe, rapid-input, and recovery coverage ([evidence](./tutorial-mobile-acceptance-2026-09-24.md))
  - [ ] Verify thumb reach, swipe separation, inline New Game choices, the `More` disclosure, background/resume, and game continuity on Android Chrome
  - [ ] Verify the same critical flow, safe-area padding, and dock layout on iPhone Safari

## Economy + Integrity

- [x] Lock-0 tile engine support + events
- [x] Lock-0 economy gating for ranked sessions
- [x] Entitlement proof signing + verification
- [x] Ranked game create requires trusted entitlement path
- [x] Auth bridge token verification path
- [x] Signed upstream auth-header bridge path
- [x] Entitlement proof minting endpoint
- [x] Dev token mint endpoint for local auth flow testing
- [x] Ranked auth/economy smoke script
- [x] Store inventory + boost consumption ledger
- [x] Paid boost packet SKU model
- [x] Ranked server-authoritative leaderboard submission flow
- [x] Ranked vs boosted mode separation enforcement for leaderboard eligibility
- [x] Undo entitlement accounting in audit trail (server-side consume + replay-visible usage)
- [x] Stripe webhook idempotency + grant-once purchase handling
- [ ] Replace the placeholder shared-secret store webhook with payment-provider-native signature verification before accepting real payments

## Platform + Ops

- [x] OpenAPI endpoint + docs page
- [x] WAF docs/checklists/scripts baseline
- [x] Security policy helper for tiered 5-min limits
- [x] Tournament guardrails for `seedCount`/`maxMoves` bounds
- [x] WAF live association + verify in production
- [x] Billing alarm + budget tripwire fully wired and validated in AWS account
- [x] Route 53 NXDOMAIN anomaly detection runbook + alarms
- [x] Add Amplify service-role SSM permission check in deploy verification workflow
- [x] CAPTCHA/challenge policy wiring by endpoint risk profile
- [x] Rate limits/quotas on heavy bot/tournament endpoints (per IP and/or per key)
- [x] Tournament job-queue/concurrency limit strategy for CPU cost control
- [x] Replay/tournament telemetry + anomaly alarms (latency/cost/WAF spike visibility)
- [x] Validate Mongo Atlas SCRAM connectivity with write/read/delete smoke against the `binary2048.runs` collection
- [x] Stand up dedicated `dev` environment (separate Amplify branch/domain + secrets + optional test data) for rapid iteration without impacting `main`/prod
- [x] Add egress architecture note for Amplify WEB_COMPUTE vs fixed-egress runtimes (what currently has no stable outbound IP and why it matters)
- [x] Decide and document production database egress strategy (open allowlist temporary vs NAT/VPC fixed egress vs Atlas PrivateLink)
- [x] Add costed egress decision memo with monthly floor estimate for NAT/VPC and Atlas PrivateLink paths
- [ ] Reduce Atlas network access from broad temporary allowlist to approved fixed egress path once runtime is migrated
  - [x] Defer always-on NAT/private-egress spend until real traffic, ranked persistence, or multi-device sessions justify migrating runtime compute into the VPC

## Public Launch Readiness + Cost Guardrails

- [x] Publish load-test runbook + scripts (baseline, ramp, spike, soak)
- [x] Define and document launch SLOs/SLIs (p50/p95 latency, error rate, saturation thresholds)
- [x] Run staged load test against gameplay routes (`/api/games`, `/api/games/:id/move`) and record pass/fail
- [x] Run abuse test against heavy routes (`/api/simulate`, `/api/bots/tournament`) with invalid/oversized payload mix
- [x] Enforce hard request-body limits on replay/sim endpoints (reject with `413`)
- [x] Enforce strict per-endpoint cost caps (max moves, max seeds, max batch size) with explicit `400`/`429` errors
- [x] Add guest-vs-authed-vs-paid rate-limit matrix doc with concrete per-5-minute limits
- [x] Implement emergency degrade mode toggles (disable heavy endpoints first under attack)
- [x] Add load-shed/circuit-breaker policy for sustained high error/latency windows
- [x] Add pre-launch cost simulation checklist and expected max daily spend envelope
- [x] Validate billing tripwire by forced threshold test in non-prod and capture evidence
- [x] Define bot-abuse incident playbook (detect, throttle, block, recover, postmortem)
- [x] Validate server-issued bot API keys and prevent arbitrary key rotation by falling back invalid/missing keys to the caller IP
- [ ] Provision production bot keys and migrate quota counters from process memory to a shared Mongo-backed store for multi-instance enforcement
  - [x] Implement atomic Mongo fixed-window counters with TTL cleanup and per-instance outage fallback
  - [x] Validate Atlas authentication and an end-to-end application counter increment (`59` to `58`) against the `rate_limits` collection
  - [x] Configure `BINARY2048_RATE_LIMIT_STORE=mongo` and the first production key hash in Amplify; verify a production count-2 per-key document and TTL index in Atlas
  - [ ] Validate simultaneous requests across separate production compute instances use the same Mongo counter
- [x] Publish rate-limit response headers and retry semantics (`429`, `Retry-After`, limit, remaining, and reset) in API responses, OpenAPI, and bot documentation
- [x] Add a dedicated high-throughput gameplay-move quota that is separate from and higher than simulation, tournament, and training quotas
- [x] Put tournament and training workloads in separate bounded queues/concurrency pools with explicit saturation responses
- [ ] Move synchronous tournament/training generation to a dedicated worker runtime for hard CPU isolation from gameplay
- [ ] Verify and capture the deployed WAF association, rule thresholds, scope-down paths, and sampled-request behavior against the application quota matrix before public bot access
  - [x] Captured the live association, managed rules, sampled-request behavior, logging state, and quota comparison on 2026-08-15 ([evidence](./waf-live-verification-2026-08-15.md))
  - [x] Deployed and re-queried bot-friendly API/global rate backstops on 2026-08-16, enabled 30-day retained logging, and removed CAPTCHA/Challenge conflicts from the bot API policy
  - [ ] Run a controlled threshold/block test against the rate rules in non-production and capture the resulting sampled request and retained log event

## Monetization Decision Track (Cost-Coverage First)

- [x] Define monthly cost target and break-even revenue target (hosting + tooling + support margin)
- [x] Implement monetization telemetry baseline (ARPDAU proxy, conversion, retention, churn impact)
- [x] Run ad-network payout research (rewarded video eCPM/fill by target geos/platforms)
- [x] Decision gate: only ship in-game ads if projected net revenue exceeds UX cost threshold
- [x] If ads are enabled: rewarded ads only (no forced gameplay-interrupt ads)
- [x] If ads are enabled: free-tier only, paid tiers remove ads
- [x] If ads are enabled: server-verified reward grants + anti-fraud checks + daily caps/cooldowns
- [x] Keep ranked integrity: ad rewards cannot affect `ranked_pure` leaderboard outcomes
- [x] Ship subscription-first fallback plan if ad economics are poor
- [x] Create player-facing monetization policy (what is paid, what is cosmetic, what is never pay-to-win)
- [x] Define three-layer economy model explicitly: game currency, premium currency, and optional external reward currency
- [x] Add internal transaction ledger schema for rewards, purchases, penalties, grants, and withdrawals
- [x] Add decision memo for external reward rails (Lightning/sats) vs internal-only rewards with abuse/cost analysis
- [x] Define reward pool sustainability model: revenue in, ops reserve, reward reserve, and payout caps
- [x] Add withdrawal policy if crypto rewards ship: minimums, cooldowns, KYC/compliance review, and fraud controls
- [x] Add server-verified proof-of-play reward model to avoid browser mining and passive farming
- [x] Add anti-farm controls for reward economy: daily caps, CAPTCHA on withdrawal, velocity checks, and behavior scoring
- [x] Add bot tournament prize model decision: internal rewards only vs external payout pools
- [x] Keep all external-value rewards segregated from ranked-pure balance until abuse model is proven safe

## Bot-First Differentiation + Competitive Depth

- [x] Add stronger reference bot (expectimax and/or Monte Carlo rollout) for meaningful tournament baselines
- [x] Add bot benchmark suite and publish seed-based benchmark table in docs
- [x] Complete an approval-gated, two-phase hosted-model benchmark with engine-evaluated legal candidate boards, fixed seeds, token/cost telemetry, and a non-thinking control versus reasoning-style finalists
- [x] Add a versioned per-run hosted-model ledger for seed/config, model type and parameters, thinking mode, scores, tiles, tokens, fallbacks, latency, cost estimates, and same-seed rollout comparisons
- [x] Capture versioned hosted-model decision traces with complete move sequences, encoded states, legal/action-mask inputs, engine candidate boards, actions, outcomes, per-move tokens, fallbacks, and latency
- [x] Export trace-complete runs into separately identified hosted-model, Ollama-model, rollout, and aggregate-metrics canonical JSONL splits, rejecting incomplete traces from step data
- [x] Derive Parquet splits and SHA-256 checksums from the canonical model benchmark JSONL export
- [x] Regenerate fixed-seed hosted and local model traces so the research dataset contains policies beyond rollout
- [x] Generate trace-complete rollout baselines for seeds 100-104 and publish them in the rollout JSONL/Parquet split
- [x] Expand bot evaluation into two separately reported tracks: reproducible seeded games and versioned curated fixed-board/Bitstorm challenge scenarios
- [x] Define the curated challenge corpus with explicit initial grids, rules/config, scenario IDs, intended skill tags, expected invariants, and replay-compatible versions
- [ ] Validate multi-step dense-board objectives with exhaustive search or a stronger reference policy before publishing pass/fail research claims
- [x] Lock RNG draw contract for wildcard multiplier selection and add strict replay-compat tests
- [x] Define Mongo/session-store migration trigger thresholds (active sessions, memory, replay volume) and execution plan
- [x] Add daily seeded challenge mode (`Bitstorm Daily`) with per-day leaderboard window
- [x] Add ghost replay race mode (human vs best bot replay on same seed)
- [x] Add replay postmortem analyzer (top 3-5 highest-cost moves from a finished run)
- [x] Add API quickstart for external bot authors (Python starter + encoded state/action-mask example)
- [x] Create bot-first launch package (Show HN post draft + Reddit/Discord technical announcement assets)

## Product Roadmap

- [x] Auth.js/OAuth provider wiring to issue auth-bridge claims from real sessions
- [x] Add auth UI shell (sign in/out controls + session/tier badge in app navigation)
- [x] Add auth-required UX messaging for protected actions (ranked submit, paid store actions, data export/delete)
- [x] Add `/auth` account page with provider/session diagnostics and bridge-token helper
- [ ] Add observable, fail-closed server-session lookup handling for auth-aware pages; read-only views may fall back to guest but authentication failures must be logged and protected actions must never silently downgrade
- [ ] Complete and document production authenticated-user acceptance testing
  - [x] Complete a real GitHub OAuth sign-in and verify the authenticated identity/session on desktop
  - [x] Verify the authenticated session persists across refresh, browser restart, and return visits
  - [x] Capture a local-only authenticated Playwright session and pass the automated session, bridge-token, protected-export, and ranked-creation checks
  - [x] Verify authenticated gameplay uses the intended user tier and per-API-key/account rate limits
  - [x] Verify ranked game creation under the real authenticated identity
  - [x] Verify leaderboard submission under the real authenticated identity
  - [x] Verify protected user-data export authorization
  - [ ] Verify protected user-data deletion authorization
  - [x] Verify authenticated store, inventory, entitlement, and paid-feature behavior
  - [ ] Verify sign-out, expired-session handling, and reauthentication recovery
  - [ ] Repeat the critical sign-in, session-resume, gameplay, and sign-out flow on Android Chrome
- [x] Notification subscriptions (app updates/player/leaderboard actions)
- [x] Async PvP same-seed mode
- [x] AI-vs-AI tournament orchestrator beyond smoke scripts
- [x] Paid/guest feature gating matrix enforced by backend policy
- [x] Admin/dev control panel for enabling/disabling UI controls
- [x] Add developer-mode top navigation shell for quick switching between core app/admin/data views
- [x] Add dedicated Store page/view (`/store`) with catalog + inventory panes
- [x] Add dedicated Leaderboard page/view (`/leaderboard`) with ranked/daily tabs and filters
- [x] Ship the semantic, responsive leaderboard presentation that replaces raw JSON
  - [x] Add browser coverage for ranked/daily rows, empty states, active tabs, sandbox labeling, keyboard focus, and narrow-screen horizontal scrolling
  - [x] Verify the presentation against both populated and empty data without treating the current per-instance leaderboard as durable
- [ ] Add leaderboard pagination plus a current-player rank/highlight after shared leaderboard persistence and authenticated player identity are available
- [ ] Build a production operations console only after its authority and data prerequisites exist
  - [ ] Define an explicit server-verified admin role/claim or allowlist; account tier (`guest`, `authed`, or `paid`) must not grant admin access
  - [ ] Expose authorized, read-only shared ops APIs for telemetry, storage status, league configuration, leaderboard operations, and model registry data
  - [ ] Keep active storage smoke writes separate from passive health/status reads
  - [ ] Build and accessibility-test the responsive ops UI after those backend prerequisites are complete
- [x] Marketing rollout hooks (social share CTAs, referral tracking)
- [x] Privacy/compliance essentials: privacy page + user data export/delete endpoints
- [x] GitHub Pages presence (repo landing page and playable-host strategy decision: iframe vs static mirror)
- [x] GitHub Pages animated intro page with non-playable board demo + production deep-link CTA
- [x] Add player chat/product messaging strategy decision: no chat vs lightweight chat vs bot-only reactions
- [x] If player chat ships: add moderation pipeline, reporting, retention policy, and abuse rate limits
- [x] Add consent model for mood/emotion-derived gameplay or assistance features
- [x] Keep any emotion-triggered gameplay effects opt-in and disabled for ranked/competitive integrity by default

## Championship/League Safe Testing Brainstorm

- [x] Add `sandbox` competition namespace (separate tables/collections from production leaderboard state)
- [x] Add `isPractice`/`isSandbox` flags on submissions; exclude by default from ranked/global queries
- [x] Add `preview season` mode (real rules + fake prizes + isolated standings)
- [x] Add admin toggle to mirror production configs into sandbox without enabling write-back
- [x] Add replay validation/load tests against sandbox seasons before enabling production season windows
- [x] Add “shadow write” option: process championship submissions fully but store results only in sandbox
- [x] Add separate API keys/rate limits for league test clients and bot tournament rehearsals
- [x] Add one-click “promote config only” flow (rules/seed pool/limits) from sandbox to production
- [x] Add synthetic league simulator script that runs full brackets against sandbox endpoints
- [x] Add explicit UI badge/watermark for sandbox seasons so users cannot confuse test vs live standings

## Persistence + ML Backlog (Post-100 Expansion)

- [x] Add MongoDB persistence layer for sessions/runs (replace in-memory store behind interface)
- [ ] Move leaderboard entries from per-instance memory to a shared persistent store before public ranked launch
- [ ] Move inventory balances, purchase idempotency, and ledger entries from per-instance memory to a shared transactional store before enabling paid features
- [ ] Convert Mongo session reads to awaited asynchronous hydration, then enable `BINARY2048_SESSION_STORE=mongo` when ranked/multi-device traffic justifies the additional Atlas operations
- [x] Persist canonical run records (`seed`, `moves`, `score`, `maxTile`, `engineVersion`, `rulesetId`, `integrity`, `createdAt`)
- [x] Store top/contest replay artifacts in S3 (compressed payload + checksum + metadata) and keep Mongo pointer
- [x] Add replay retention policy (TTL tiers: hot in Mongo, warm in S3, purge policy for guest data)
- [x] Add idempotent replay ingest worker for async tournament uploads (API -> queue -> persistence)
- [x] Add run index strategy (playerId/date, score desc, rulesetId, contestId) and query latency SLO
- [x] Add `/api/runs/:id` + `/api/runs/:id/replay` backed by persistent storage
- [x] Add deterministic training dataset export job (Parquet/JSONL) for ML with PII-safe schema
- [ ] Keep `botvsbot/binary2048` private until a public research-release audit is approved
- [ ] Before public release, verify every published row is synthetic bot-generated data with no player identifiers, Mongo records, secrets, environment values, operational logs, or internal handoff notes
- [ ] Publish research-safe files only (`README.md`/dataset card and Parquet data); exclude the executable/non-portable pickle replay buffer unless a documented need and security review justify it
- [ ] Complete public dataset documentation: provenance, dataset/engine/ruleset versions, seed range and RNG semantics, bot policy/version, exact generation command, limitations, intended uses, and citation
- [ ] Confirm Binary-2048 owns the data and Apache-2.0 is appropriate for every published artifact
- [ ] Add checksums, explicit train/validation/test split guidance, and immutable tagged dataset releases before changing visibility
- [ ] After the release audit passes, make the synthetic dataset public; use gated access instead for any future human-derived or consent-sensitive dataset
- [x] Add feature extractor job for model inputs (encoded state/action mask + outcome labels)
- [x] Add baseline offline ML pipeline (train/eval/report) using persisted runs
- [x] Add a local Ollama zero-shot bot baseline with structured legal-action output, deterministic fallback, latency reporting, and no Binary-2048 training-data dependency
- [x] Add model registry/version pinning for bot policies and tournament fairness
- [x] Add inference safety gate (model timeout + fallback policy + deterministic seed logging)
- [x] Add storage/cost guardrails for Mongo/S3 (budgets, lifecycle rules, object count alarms)
- [x] Add disaster recovery runbook for replay storage (restore drills + checksum verification)

## Telemetry + SEO + Product Learning

- [x] Add event taxonomy spec (session, move, replay, share, store, auth, error) with stable schema versions
- [x] Add privacy-safe analytics pipeline (client events -> API ingest -> warehouse/S3) with PII minimization
- [x] Add interaction telemetry dashboards (funnel: land -> new game -> move -> replay/share -> return)
- [x] Add gameplay friction analysis (rage-quit points, no-op rates, undo usage, loss reasons by mode/difficulty)
- [x] Add SEO baseline for marketing pages (meta tags, OpenGraph/Twitter cards, sitemap.xml, robots.txt, canonical tags)
- [x] Add structured data (Organization, WebSite, SoftwareApplication) on public landing/docs pages
- [x] Add search indexing/health checks (GSC/Bing verification + crawl error monitoring)
- [x] Add experimentation framework for UI improvements (A/B flags + guardrails + holdout tracking)
- [x] Add ML training-data policy for telemetry joins (consent classes, retention window, anonymization constraints)
- [x] Add bot-vs-human behavior segmentation metrics to guide balancing and anti-abuse tuning
- [x] Evaluate emotion classification stack for chat/support signals (for example `roberta-base-go_emotions`) with accuracy, latency, and privacy review
- [x] Define allowed emotion use cases: analytics, hint timing, UX adaptation, support triage, bot flavor text
- [x] Reject disallowed emotion use cases: covert manipulation, ranked balance changes, or punitive emotional targeting
- [x] Add mood analytics dashboard for aggregated player sentiment only if consent and moderation requirements are met
- [x] Add hint-assist experiment driven by detected confusion/friction signals, limited to non-ranked modes
- [x] Add bot personality/reaction layer that can simulate emotion safely without storing sensitive user inference by default
- [x] Define event-trigger policy for emotion-linked game effects (`confusion -> hint`, `joy -> flourish`) and keep chaos/reward triggers out of ranked
- [x] Add model evaluation set for mood detection drift, false positives, and abuse edge cases
- [x] Add privacy review for emotional inference retention, export/delete handling, and disclosure requirements
- [x] Add UX audit instrumentation for accidental taps, rage taps, dead clicks, and mobile mis-taps around board controls
- [x] Evaluate lightweight UX feedback/session-replay tooling (`Microsoft Clarity` vs `PostHog`) with privacy constraints and retention limits

## Merch + Swag

- [x] Define merch/store strategy for physical swag separate from in-game store economy
- [x] Add merch concept pack for hats, shirts, stickers, and logo variants including `FBBB` / `For Bots By Bots`
- [ ] Evaluate print-on-demand providers, margins, fulfillment risk, and brand-quality thresholds
- [ ] Add simple swag landing/view concept and decide whether it lives in-app, on GitHub Pages, or on an external storefront
- [ ] Explore visual identity options for `F-cubed` / `FBBB` acronym mark and how it fits the main Binary-2048 brand

## LLM Safety + Agentic Features

- [x] Add prompt-injection threat model for all LLM-facing surfaces (blog generation, tile ideation, dashboards, chat, admin tools)
- [x] Add trust-boundary rules: untrusted player text must never directly control secrets, tools, deploy steps, or payouts
- [x] Add content sanitization pipeline before LLM ingestion (strip markup, URLs, prompts, hidden instructions where possible)
- [x] Add output validation layer for agent-generated changes (tests, lint, schema checks, replay compatibility, manual approval)
- [x] Add role isolation for multi-agent workflows so proposer/implementer/reviewer cannot self-approve
- [x] Add audit log for LLM-originated content/code/config changes with human approver identity
- [x] Add safe fallback behavior when prompt-injection or jailbreak signals are detected
- [x] Add secret-handling policy for LLM tools so runtime tokens, DB URIs, and admin secrets are never exposed to model context unnecessarily

## Production Test Coverage Brainstorm

- [x] Add lightweight prod smoke script (`/`, `/auth`, `/api/health`) to verify live HTML/API responses
- [x] Add scheduled prod smoke workflow (4 checks/day: 2 day, 2 night) with alerting on failure
- [x] Add synthetic gameplay canary in prod (create game + one move + export) with strict timeout budget
- [x] Add post-deploy verification gate (block rollout completion until smoke + canary pass)
- [x] Add digest/error fingerprint tracker (collect unique Next.js digests and correlate to deploy id)
- [x] Add regional POP probe scaffold workflow (`x-amz-cf-pop` capture + scheduled checks)
- [x] Add regional checks (at least 2 POP/regions) to catch edge-specific failures
- [x] Add browser synthetic checks (Playwright against prod) for critical UI actions
- [x] Add rollback trigger policy for repeated prod smoke failures within rolling window
- [x] Add release checklist item: verify auth/session endpoints before announcing deploy
- [x] Add incident evidence bundle script (curl snapshots + headers + log links) for fast triage

## Content + Community + LLM Ops Track (New)

- [x] Add weekly/monthly LLM-generated blog pipeline (topic seed list, draft, fact-check, publish queue)
- [x] Add editorial guardrails: politically/religiously neutral tone enforcement and rejection tests
- [x] Add blog topic packs for game-adjacent categories: bots, leaderboard interviews, social, tech, game culture, math, science
- [x] Add player/guest bot spotlight format with template + moderation checklist
- [x] Add game analytics dashboard (active games, runs/minute, mode/difficulty split, move rates, replay exports)
- [x] Add leaderboard operations dashboard (submission volume, rejection reasons, sandbox vs live share)
- [x] Add LLM tile ideation workflow (weekly tile proposal with mechanics + icon prompt + safety constraints)
- [x] Add “tile of the week” feature flag system with start/end window and automatic expiry
- [x] Add entitlement policy for weekly tiles (paid users + local dev toggle controls)
- [x] Add multi-agent content pipeline: proposer LLM -> implementer agent -> reviewer agent -> merge gate
- [x] Add automated PR quality gate for LLM-generated tile changes (tests, lint, replay compatibility checks)
- [x] Add community voting flow for tile ideas (submit, vote window, anti-spam/rate limit, winner promotion)
- [x] Add governance for community winner rollout (manual override, safety kill switch, rollback path)
- [x] Add editorial pipeline for leaderboard interviews, guest bot spotlights, and neutral technical/community stories
- [x] Add monthly “bot reactions” or “bot personalities” content feature without affecting competitive fairness
- [x] Add weekly experimental tile review board: proposal, implementation, review, sandbox test, promotion, rollback
- [x] Add public issue-reporting path to GitHub (header/footer links, issue templates, bug vs idea categories)
- [x] Add in-app “Report issue” flow with prefilled GitHub issue link carrying page/build/version context
- [x] Add triage labels/project convention for player-reported bugs, gameplay ideas, and balance feedback
