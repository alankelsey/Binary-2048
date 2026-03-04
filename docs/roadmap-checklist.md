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
- [ ] Signed replay tokens for ranked submissions (HMAC on replay payload; reject tampered metadata/moves)
- [ ] Replay URL oversize fallback: short-lived signed server-hosted replay when encoded URL exceeds safe length
- [ ] Engine version pinning strategy for tournaments/replays across version upgrades
- [ ] Replay storage strategy doc: no-DB default + Mongo migration model for top scores/contests

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
- [ ] Ranked vs boosted mode separation enforcement for leaderboard eligibility
- [ ] Undo entitlement accounting in audit trail (server-side consume + replay-visible usage)
- [ ] Stripe webhook idempotency + grant-once purchase handling

## Platform + Ops

- [x] OpenAPI endpoint + docs page
- [x] WAF docs/checklists/scripts baseline
- [x] Security policy helper for tiered 5-min limits
- [x] Tournament guardrails for `seedCount`/`maxMoves` bounds
- [ ] WAF live association + verify in production
- [ ] Billing alarm + budget tripwire fully wired and validated in AWS account
- [ ] Route 53 NXDOMAIN anomaly detection runbook + alarms
- [ ] CAPTCHA/challenge policy wiring by endpoint risk profile
- [ ] Rate limits/quotas on heavy bot/tournament endpoints (per IP and/or per key)
- [ ] Tournament job-queue/concurrency limit strategy for CPU cost control
- [ ] Replay/tournament telemetry + anomaly alarms (latency/cost/WAF spike visibility)

## Product Roadmap

- [ ] Auth.js/OAuth provider wiring to issue auth-bridge claims from real sessions
- [x] Notification subscriptions (app updates/player/leaderboard actions)
- [ ] Async PvP same-seed mode
- [x] AI-vs-AI tournament orchestrator beyond smoke scripts
- [x] Paid/guest feature gating matrix enforced by backend policy
- [x] Admin/dev control panel for enabling/disabling UI controls
- [x] Marketing rollout hooks (social share CTAs, referral tracking)
- [ ] Privacy/compliance essentials: privacy page + user data export/delete endpoints
