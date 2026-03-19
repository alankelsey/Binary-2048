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
- [x] Stand up dedicated `dev` environment (separate Amplify branch/domain + secrets + optional test data) for rapid iteration without impacting `main`/prod
- [x] Add egress architecture note for Amplify WEB_COMPUTE vs fixed-egress runtimes (what currently has no stable outbound IP and why it matters)
- [x] Decide and document production database egress strategy (open allowlist temporary vs NAT/VPC fixed egress vs Atlas PrivateLink)
- [x] Add costed egress decision memo with monthly floor estimate for NAT/VPC and Atlas PrivateLink paths
- [ ] Reduce Atlas network access from broad temporary allowlist to approved fixed egress path once runtime is migrated

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
- [x] Notification subscriptions (app updates/player/leaderboard actions)
- [x] Async PvP same-seed mode
- [x] AI-vs-AI tournament orchestrator beyond smoke scripts
- [x] Paid/guest feature gating matrix enforced by backend policy
- [x] Admin/dev control panel for enabling/disabling UI controls
- [x] Add developer-mode top navigation shell for quick switching between core app/admin/data views
- [x] Add dedicated Store page/view (`/store`) with catalog + inventory panes
- [x] Add dedicated Leaderboard page/view (`/leaderboard`) with ranked/daily tabs and filters
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
- [x] Persist canonical run records (`seed`, `moves`, `score`, `maxTile`, `engineVersion`, `rulesetId`, `integrity`, `createdAt`)
- [x] Store top/contest replay artifacts in S3 (compressed payload + checksum + metadata) and keep Mongo pointer
- [x] Add replay retention policy (TTL tiers: hot in Mongo, warm in S3, purge policy for guest data)
- [x] Add idempotent replay ingest worker for async tournament uploads (API -> queue -> persistence)
- [x] Add run index strategy (playerId/date, score desc, rulesetId, contestId) and query latency SLO
- [x] Add `/api/runs/:id` + `/api/runs/:id/replay` backed by persistent storage
- [x] Add deterministic training dataset export job (Parquet/JSONL) for ML with PII-safe schema
- [x] Add feature extractor job for model inputs (encoded state/action mask + outcome labels)
- [x] Add baseline offline ML pipeline (train/eval/report) using persisted runs
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

- [ ] Add weekly/monthly LLM-generated blog pipeline (topic seed list, draft, fact-check, publish queue)
- [ ] Add editorial guardrails: politically/religiously neutral tone enforcement and rejection tests
- [ ] Add blog topic packs for game-adjacent categories: bots, leaderboard interviews, social, tech, game culture, math, science
- [ ] Add player/guest bot spotlight format with template + moderation checklist
- [ ] Add game analytics dashboard (active games, runs/minute, mode/difficulty split, move rates, replay exports)
- [ ] Add leaderboard operations dashboard (submission volume, rejection reasons, sandbox vs live share)
- [ ] Add LLM tile ideation workflow (weekly tile proposal with mechanics + icon prompt + safety constraints)
- [ ] Add “tile of the week” feature flag system with start/end window and automatic expiry
- [ ] Add entitlement policy for weekly tiles (paid users + local dev toggle controls)
- [ ] Add multi-agent content pipeline: proposer LLM -> implementer agent -> reviewer agent -> merge gate
- [ ] Add automated PR quality gate for LLM-generated tile changes (tests, lint, replay compatibility checks)
- [ ] Add community voting flow for tile ideas (submit, vote window, anti-spam/rate limit, winner promotion)
- [ ] Add governance for community winner rollout (manual override, safety kill switch, rollback path)
- [ ] Add editorial pipeline for leaderboard interviews, guest bot spotlights, and neutral technical/community stories
- [ ] Add monthly “bot reactions” or “bot personalities” content feature without affecting competitive fairness
- [ ] Add weekly experimental tile review board: proposal, implementation, review, sandbox test, promotion, rollback
- [x] Add public issue-reporting path to GitHub (header/footer links, issue templates, bug vs idea categories)
- [x] Add in-app “Report issue” flow with prefilled GitHub issue link carrying page/build/version context
- [ ] Add triage labels/project convention for player-reported bugs, gameplay ideas, and balance feedback
