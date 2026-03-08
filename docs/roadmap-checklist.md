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
- [x] CAPTCHA/challenge policy wiring by endpoint risk profile
- [x] Rate limits/quotas on heavy bot/tournament endpoints (per IP and/or per key)
- [x] Tournament job-queue/concurrency limit strategy for CPU cost control
- [x] Replay/tournament telemetry + anomaly alarms (latency/cost/WAF spike visibility)

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

## Persistence + ML Backlog (Post-100 Expansion)

- [ ] Add MongoDB persistence layer for sessions/runs (replace in-memory store behind interface)
- [x] Persist canonical run records (`seed`, `moves`, `score`, `maxTile`, `engineVersion`, `rulesetId`, `integrity`, `createdAt`)
- [ ] Store top/contest replay artifacts in S3 (compressed payload + checksum + metadata) and keep Mongo pointer
- [ ] Add replay retention policy (TTL tiers: hot in Mongo, warm in S3, purge policy for guest data)
- [ ] Add idempotent replay ingest worker for async tournament uploads (API -> queue -> persistence)
- [ ] Add run index strategy (playerId/date, score desc, rulesetId, contestId) and query latency SLO
- [x] Add `/api/runs/:id` + `/api/runs/:id/replay` backed by persistent storage
- [ ] Add deterministic training dataset export job (Parquet/JSONL) for ML with PII-safe schema
- [ ] Add feature extractor job for model inputs (encoded state/action mask + outcome labels)
- [ ] Add baseline offline ML pipeline (train/eval/report) using persisted runs
- [ ] Add model registry/version pinning for bot policies and tournament fairness
- [ ] Add inference safety gate (model timeout + fallback policy + deterministic seed logging)
- [ ] Add storage/cost guardrails for Mongo/S3 (budgets, lifecycle rules, object count alarms)
- [ ] Add disaster recovery runbook for replay storage (restore drills + checksum verification)
