# Binary-2048

Next.js App Router scaffold for a Binary 2048 web game with deterministic simulation APIs.

## Features

- Binary variant rules:
  - `0` annihilates with anything
  - `1 + 1 => 2`, then powers-of-two progression
  - Wildcard tiles `W(k)` multiply number tiles
- Deterministic RNG (`seed + rngStep`) for reproducible scenarios
- In-memory game sessions and export API
- Scenario simulation endpoint for tests
- Replay JSON viewer: load export files and step through turns
- Built-in social sharing actions (X, LinkedIn, copy share text)
- Referral-aware share links with UTM campaign tags and marketing event hooks
- Theme packs with persistent selection (`Midnight`, `Aurora`, `Ember`, `Light`)
- Accessibility helper panel with keyboard shortcuts and tab-order map
- Dev/admin control panel to toggle UI options visibility at runtime
- Import integrity metadata (`created` vs `imported`, imported sessions flagged unranked)
- Store icon system primitives with rarity color coding

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
API docs UI: `http://localhost:3000/api-docs`.
Docs hub: `http://localhost:3000/docs`.
User docs: `http://localhost:3000/docs/user`.
Developer docs: `http://localhost:3000/docs/developer`.
Replay storage strategy: `docs/replay-storage-strategy.md`.
Privacy page: `http://localhost:3000/privacy`.
Replay share UI: `http://localhost:3000/replay?code=...`.
In-app share row includes `Copy Replay Link` for the current run.
GitHub Pages setup guide: `docs/github-pages.md`.
Feature review checklist runbook: `docs/feature-review-runbook.md`.
Load test runbook: `docs/load-test-runbook.md`.
Launch SLO/SLI targets: `docs/launch-slo-sli.md`.
Monetization targets: `docs/monetization-targets.md`.
Monetization telemetry baseline: `docs/monetization-telemetry-baseline.md`.
Ad payout research snapshot: `docs/ad-network-payout-research-2026-03.md`.

Controls: swipe on mobile, arrow keys, and `W/A/S/D`.

Tiny bot smoke runner (in another terminal while dev server is running):

```bash
npm run bot:smoke
```

One-command bot smoke with temporary local dev server:

```bash
npm run bot:smoke:dev
```

Keep temporary per-port dev output dirs for troubleshooting:

```bash
KEEP_DEV_DIST=1 npm run test:dev
KEEP_DEV_DIST=1 npm run bot:smoke:dev
KEEP_DEV_DIST=1 npm run bot:tourney:dev
```

Dev helper scripts automatically normalize `next-env.d.ts` after they exit to reduce generated diff noise.

Auth proof smoke (ranked entitlement flow):

```bash
BINARY2048_ENABLE_DEV_AUTH_TOKEN=1 \
BINARY2048_AUTH_BRIDGE_SECRET=dev-auth-secret \
BINARY2048_ENTITLEMENT_SECRET=dev-ent-proof-secret \
npm run dev
```

In a second terminal:

```bash
npm run smoke:auth-proof
```

Auth.js OAuth wiring (for real-session bridge tokens):

```bash
AUTH_SECRET=replace-me \
AUTH_GITHUB_ID=... \
AUTH_GITHUB_SECRET=... \
AUTH_GOOGLE_ID=... \
AUTH_GOOGLE_SECRET=... \
BINARY2048_AUTH_BRIDGE_SECRET=replace-me \
npm run dev
```

Then mint bridge token from authenticated session:

```bash
curl -sS -X POST http://localhost:3000/api/auth/bridge-token \
  -H "Content-Type: application/json" \
  -d '{"ttlSeconds":300}'
```

Tiny same-seed multibot tournament:

```bash
npm run bot:tourney
```

Tournament API (server-side orchestrator):

```bash
curl -sS -X POST http://localhost:3000/api/bots/tournament \
  -H "Content-Type: application/json" \
  -d '{"seedStart":100,"seedCount":3,"maxMoves":250}'
```

One-command tournament with temporary local dev server:

```bash
npm run bot:tourney:dev
```

Roadmap completion status:

```bash
npm run roadmap:status
```

Recommended pre-push verification:

```bash
npm run verify
```

CI is automated in GitHub Actions (`.github/workflows/ci.yml`) and runs unit tests + production build on every push/PR to `main`.

WAF setup helper (requires AWS CLI credentials + CloudFront distribution id):

```bash
DIST_ID=E123ABC456XYZ LOG_GROUP_NAME=aws-waf-logs-binary2048 npm run ops:waf:setup
```

Discover candidate distributions:

```bash
APP_DOMAIN=binary2048.com npm run ops:waf:discover
```

WAF strict setup (geo block + CAPTCHA rule template):

```bash
DIST_ID=E123ABC456XYZ WAF_TEMPLATE_FILE=docs/waf-web-acl-template-strict.json npm run ops:waf:setup
```

WAF game-API setup (endpoint-specific CAPTCHA/challenge rules):

```bash
DIST_ID=E123ABC456XYZ WAF_TEMPLATE_FILE=docs/waf-web-acl-template-game-api.json npm run ops:waf:setup
```

WAF verify and rollback helpers:

```bash
DIST_ID=E123ABC456XYZ npm run ops:waf:verify
DIST_ID=E123ABC456XYZ npm run ops:waf:rollback
```

WAF policy check helper:

```bash
DIST_ID=E123ABC456XYZ npm run ops:waf:check
```

WAF backup helper:

```bash
DIST_ID=E123ABC456XYZ npm run ops:waf:export
```

Billing SNS helper:

```bash
TOPIC_NAME=binary2048-billing-alerts SUBSCRIBE_EMAIL=you@example.com npm run ops:waf:sns
```

Billing tripwire helper:

```bash
BUDGET_EMAIL=you@example.com BUDGET_AMOUNT_USD=50 npm run ops:waf:budget
```

Tripwire notification thresholds default to `50 80 100`; override with:

```bash
NOTIFICATION_THRESHOLDS="40 70 95" npm run ops:waf:budget
```

Billing tripwire verification:

```bash
BUDGET_NAME=binary2048-monthly-cost ALARM_NAME=WAFBlockedRequestsHigh npm run ops:waf:tripwire-check
```

Forced tripwire validation + evidence capture (non-prod recommended):

```bash
AWS_REGION=us-east-1 npm run ops:waf:tripwire-validate
```

Require alarm actions check:

```bash
REQUIRE_ALARM_ACTIONS=1 npm run ops:waf:tripwire-check
```

One-command WAF/billing doctor:

```bash
DIST_ID=E123ABC456XYZ npm run ops:waf:doctor
```

End-to-end WAF smoke:

```bash
DIST_ID=E123ABC456XYZ APP_DOMAIN=binary2048.com npm run ops:waf:smoke
```

Route 53 NXDOMAIN anomaly setup:

```bash
QUERY_LOG_GROUP_NAME=/aws/route53/your-zone npm run ops:waf:nxdomain
```

Load testing profiles (requires `k6`):

```bash
BASE_URL=http://localhost:3000 npm run load:baseline
BASE_URL=http://localhost:3000 npm run load:ramp
BASE_URL=http://localhost:3000 npm run load:spike
BASE_URL=http://localhost:3000 SOAK_DURATION=10m SOAK_VUS=30 npm run load:soak
```

Staged gameplay load + pass/fail report:

```bash
BASE_URL=http://localhost:3000 npm run load:stage:gameplay
```

Staged heavy abuse load + pass/fail report:

```bash
BASE_URL=http://localhost:3000 npm run load:stage:abuse
```

## API

- `POST /api/games`
  - Body: `{ "config": Partial<GameConfig>, "initialGrid": Cell[][] }` (both optional)
  - Returns created game state
  - Challenge risk profile: `medium` (guest requests may require challenge token when enabled)
- `GET /api/games/:id`
  - Returns current game state
- `POST /api/games/:id/move`
  - Body: `{ "dir": "up" | "down" | "left" | "right" }` or `{ "action": "L" | "R" | "U" | "D" }`
  - Optional concurrency guard: `expectStateHash` (returns `409` if stale)
  - Applies one move and returns updated state
  - AI-friendly fields included in response:
    - `action` (compact move code)
    - `dir` (normalized full direction)
    - `stateHash` (post-move deterministic hash)
    - `changed` (whether move altered board)
    - `reward` (score delta for move)
    - `done` (game over or won)
    - `spawned` (first spawn event summary when present)
    - `undo` (`limit`, `used`, `remaining`)
    - `info` (`changed`, `spawned`, `events`, `illegalMove`)
- `POST /api/games/:id/undo`
  - Reverts one move for the current in-memory session
  - Enforces per-run undo limits by difficulty:
    - `Normal`: 2
    - `LTFG`: 1
    - `Death by AI`: 0
- `GET /api/games/:id/encoded`
  - Returns AI-friendly encoded state + legal moves + ruleset/version metadata
  - Includes:
    - `actionSpace`: `["L","R","U","D"]`
    - `legalActions`: subset of action space for current state
    - `actionMask`: fixed-order legality mask aligned to `actionSpace` (e.g. `[1,0,1,0]`)
    - `encodedFlat`: flattened tensor-friendly encoding `[type0,value0,type1,value1,...]`
    - `stateHash`: deterministic hash of encoded board + turn/score/RNG step
- `GET /api/games/:id/export`
  - Returns export JSON (download attachment)
  - Includes replay-critical metadata: `rulesetId`, `engineVersion`, `spawnProbs`, and compact replay (`seed`, `moves`, `movesApplied`)
  - Includes undo audit metadata at `meta.undo`: `limit`, `used`, `remaining`, and undo `events`
  - When `BINARY2048_REPLAY_CODE_SECRET` is configured, includes replay HMAC `signature`
  - Optional query: `?compact=1` to return replay-only payload (`header`, `moves`)
  - Optional query: `?audit=1` to include deterministic replay audit hash chain at `meta.audit`
- `GET /api/games/:id/replay`
  - Returns canonical replay payload with only:
    - `header`
    - `moves`
- `POST /api/auth/entitlements/proof`
  - Mints short-lived signed entitlement proof for ranked flows from a signed auth-bridge token
  - Requires:
    - either `Authorization: Bearer <auth-bridge-token>` with `BINARY2048_AUTH_BRIDGE_SECRET`, or
    - signed upstream auth headers (`x-binary2048-auth-claims`, `x-binary2048-auth-sig`) with `BINARY2048_AUTH_HEADER_SECRET`
    - `BINARY2048_ENTITLEMENT_SECRET` on server
  - Optional body: `{ "sessionClass": "ranked" | "unranked" }`
  - Returns `{ proof, exp, sessionClass, userTier, entitlements }`
- `POST /api/auth/dev-token`
  - Dev-only helper to mint auth-bridge bearer tokens for local/integration testing
  - Requires:
    - `BINARY2048_ENABLE_DEV_AUTH_TOKEN=1`
    - `BINARY2048_AUTH_BRIDGE_SECRET`
  - Optional body: `{ "sub"?, "tier"?, "entitlements"?, "ttlSeconds"? }`
  - Returns `{ token, exp, ttlSeconds, userTier, entitlements }`
- `POST /api/auth/bridge-token`
  - Mints auth-bridge bearer token from an authenticated Auth.js session (GitHub/Google OAuth)
  - Requires:
    - `BINARY2048_AUTH_BRIDGE_SECRET`
    - Auth.js providers configured (example env vars below)
  - Optional body: `{ "ttlSeconds"?: number }`
  - Returns `{ token, exp, ttlSeconds, userTier, entitlements }`
- `GET /api/leaderboard?limit=20`
  - Lists ranked leaderboard entries sorted by score, max tile, and moves
- `POST /api/leaderboard/submit`
  - Body: `{ "gameId": "g_123" }`
  - Requires authenticated auth-bridge claims
  - Server-authoritative: score/moves/state hash are derived from in-memory ranked game session, not from client payload
  - Only accepts ranked created sessions that are finished (`won` or `over`)
  - Enforces ranked-vs-boosted separation:
    - `ranked_pure` sessions are eligible
    - boosted sessions (seeded start grids and other non-standard starts) are rejected from ranked leaderboard
- `POST /api/bots/tournament`
  - Body (optional): `{ "seeds"?: number[], "seedStart"?: number, "seedCount"?: number, "maxMoves"?: number, "bots"?: ["priority" | "random" | "alternate"] }`
  - Runs same-seed AI-vs-AI tournament server-side and returns ranking + per-run summaries
  - Rate-limited per API key (or IP fallback) with `429` responses on quota exhaustion
  - Concurrency-protected by bounded queue (`503` with `queue_full`/`queue_timeout` when saturated)
  - Queue env knobs:
    - `BINARY2048_TOURNAMENT_MAX_CONCURRENT` (default `2`)
    - `BINARY2048_TOURNAMENT_MAX_QUEUE` (default `8`)
    - `BINARY2048_TOURNAMENT_QUEUE_WAIT_TIMEOUT_MS` (default `15000`)
  - Emits telemetry to `/api/ops/telemetry`
  - Challenge risk profile: `high` (challenge required when enabled)
- `POST /api/matches/same-seed`
  - Creates an async same-seed PvP match
  - Body (optional): `{ "createdBy"?: string, "opponentId"?: string, "seed"?: number, "config"?: Partial<GameConfig> }`
  - Uses auth-bridge `sub` as fallback `createdBy` when omitted
- `GET /api/matches/:id`
  - Returns async match payload + standings
- `POST /api/matches/:id/submit`
  - Submits one player's move list for async same-seed scoring
  - Body: `{ "playerId"?: string, "moves": Array<Dir | "L" | "R" | "U" | "D"> }`
  - Uses auth-bridge `sub` as fallback `playerId` when omitted
- `POST /api/marketing/track`
  - Body: `{ "type": "share_click" | "copy_share" | "copy_replay_link" | "landing_visit", "channel"?: "x" | "linkedin" | "copy" | "replay", "referralCode"?: string, "campaign"?: string }`
  - Stores lightweight marketing/share CTA event for rollout analytics
- `GET /api/marketing/events?limit=50`
  - Lists recent tracked marketing events (newest first)
- `GET /api/ops/telemetry`
  - Returns in-memory telemetry snapshot for replay/tournament route latency/error/cost visibility
  - Includes anomaly flags (`latency_spike`, `error_rate_spike`, `cost_spike`) per route
- `GET /api/user/data/export`
  - Authenticated user data export bundle (inventory, ledger, subscriptions, leaderboard entries)
- `DELETE /api/user/data`
  - Authenticated user data deletion (inventory, ledger, subscriptions, leaderboard entries)
- `POST /api/sim/run`
  - Body: `{ "config": GameConfig, "initialGrid": Cell[][], "moves": Dir[] }`
  - Runs deterministic scenario and returns export JSON
- `POST /api/simulate`
  - Body: `{ "seed"?: number, "moves": Array<Dir | "L" | "R" | "U" | "D">, "config"?: Partial<GameConfig> & { size?: number }, "initialGrid"?: Cell[][], "includeSteps"?: boolean }`
  - Runs batch simulation and returns final state, score, and step summaries
  - Rate-limited per API key (or IP fallback) with `429` responses on quota exhaustion
  - Challenge risk profile: `high` (challenge required when enabled)
  - Includes compact terminal artifacts for bot clients:
    - `finalStateHash`
    - `finalEncodedFlat`
    - `finalActionMask`
- `POST /api/replay`
  - Body:
    - Full export JSON payload, or
    - `{ "header"?: { "rulesetId"?: string, "seed"?: number }, "config": GameConfig, "initialGrid": Cell[][], "moves": Array<Dir | "L" | "R" | "U" | "D"> }`
  - Deterministically reconstructs a run and returns final state + step summaries
- `POST /api/replay/validate`
  - Body: replay/export payload or `{ "payload": replayPayload, "signature": "..." }`
  - Returns `{ "ok": boolean, "reason": string, "details"?: { ... } }`
  - Performs replay compatibility checks and deterministic rerun validation
  - Verifies signature when provided and signing secret is configured
  - Supports engine version pinning via env:
    - `BINARY2048_ENGINE_VERSION` (expected version)
    - `BINARY2048_REPLAY_ENGINE_PIN_MODE` (`exact` | `minor` | `off`)
  - Emits telemetry to `/api/ops/telemetry`

Challenge policy env:

- `BINARY2048_CHALLENGE_MODE=off|log|enforce` (default `off`)
- `BINARY2048_CHALLENGE_SECRET=<token>` (required for effective enforcement)
- Client header: `x-binary2048-challenge-token`
- `POST /api/replay/code`
  - Body: replay/export payload
  - Returns replay `code` + length and guardrail flags
  - If encoded replay exceeds URL limits, route falls back to a short-lived signed hosted replay token
- `GET /api/replay/code?code=...`
  - Decodes replay code into compact replay payload (`header`, `config`, `initialGrid`, `moves`)
  - Supports both inline encoded replay codes and hosted replay tokens
- `GET /api/openapi`
  - Returns OpenAPI 3.1 JSON for current API surface
- `GET /api/subscriptions?subscriberId=...`
  - Lists notification subscriptions for a subscriber id
- `POST /api/subscriptions`
  - Creates/updates notification subscriptions
  - Body: `{ "subscriberId": string, "transport": "email" | "webhook" | "inapp", "endpoint": string, "topics": ["app_updates" | "player_actions" | "leaderboard_actions"], "enabled"?: boolean }`
  - Tier-based topic gating is enforced server-side:
    - `guest`: `app_updates`
    - `authed`: `app_updates`, `player_actions`
    - `paid`: `app_updates`, `player_actions`, `leaderboard_actions`
- `DELETE /api/subscriptions?id=...`
  - Deletes a subscription by id
- `GET /api/store/inventory?subscriberId=...`
  - Returns inventory balances + recent ledger entries
- `GET /api/store/catalog`
  - Returns active paid packet SKUs and their grant bundles
- `POST /api/store/purchase`
  - Purchases packet SKU and grants all bundled inventory items
  - Body: `{ "subscriberId": string, "packetSku": string, "quantity"?: number }`
- `POST /api/store/webhook`
  - Idempotent webhook processor for payment completion events
  - Supports grant-once behavior by event id and payment reference
  - Optional shared-secret guard via `BINARY2048_STORE_WEBHOOK_SECRET` + `x-store-webhook-secret` header
- `POST /api/store/inventory`
  - Grants inventory
  - Body: `{ "subscriberId": string, "sku": "undo_charge" | "wild_boost_pack" | "lock_breaker", "quantity": number, "reason"?: "grant" | "consume" | "adjust" }`
- `POST /api/store/consume`
  - Consumes inventory and appends ledger entry
  - Body: `{ "subscriberId": string, "sku": "undo_charge" | "wild_boost_pack" | "lock_breaker", "quantity": number, "reason"?: "grant" | "consume" | "adjust" }`

## Example Scenario Payload

```json
{
  "config": {
    "width": 4,
    "height": 4,
    "seed": 99,
    "winTile": 2048,
    "zeroBehavior": "annihilate",
    "spawnOnNoopMove": false,
    "spawn": {
      "pZero": 0,
      "pOne": 1,
      "pWildcard": 0,
      "wildcardMultipliers": [2, 4, 8]
    }
  },
  "initialGrid": [
    [{ "t": "w", "m": 2 }, { "t": "w", "m": 2 }, { "t": "n", "v": 1 }, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ],
  "moves": ["left"]
}
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).

## Roadmap Additions

Trackable checklist source:
- [docs/roadmap-checklist.md](./docs/roadmap-checklist.md)

### Status Snapshot (March 3, 2026)

- Completed foundations:
  - Deterministic engine + replay export data (`rulesetId`, `engineVersion`, replay seed/moves).
  - Encoded state + legal action APIs for bot clients.
  - Replay viewer with step-through controls.
  - Undo limits by difficulty.
  - Theme and color mode system with persistence.
  - OpenAPI spec endpoint + in-app docs page.
  - Active-run controls policy in UI (new/undo/export/replay only while active).
  - Lock-0 engine prototype with cooldown-gated annihilation + replay events (`lock_block`, `lock_break`).
  - Lock-0 gameplay wiring: spawn probability support (`pLock`) + board rendering (`⛓` lock tile styling).
  - Lock-0 economy policy in game creation: ranked sessions require `lock_tiles_ranked` entitlement to keep lock spawn enabled.
  - Auth-backed entitlement issuance endpoint for ranked sessions (`POST /api/auth/entitlements/proof`) using signed auth bridge token + short-lived signed proof.
  - Ranked game creation can consume verified auth-bridge claims directly (no client tier trust) when proof is absent.
  - Signed header auth-bridge support for trusted upstream middleware/session bridge (`x-binary2048-auth-claims` + HMAC sig).
  - Dev-only auth bridge token mint endpoint (`POST /api/auth/dev-token`) for local ranked/economy flow testing.
  - Replay-code signing/verification support via `BINARY2048_REPLAY_CODE_SECRET` to reject tampered signed replay links.
  - Replay code compression fallback (`r1z.`) when plain replay code exceeds length guardrails, with legacy replay-code decode compatibility.
  - Replay URL oversize fallback (`rs1.` short-lived hosted token) for oversized shareable replays.
  - Replay validation engine-version pin mode (`exact`/`minor`/`off`) for tournament/replay upgrade safety.
  - Canonical replay endpoint (`GET /api/games/:id/replay`) for replay-only payload shape (`header`, `moves`).
  - Win celebration flow: large win overlay with `Continue`/`New Game` actions and ranked-default continue lockout.
- Next implementation focus:
  - Wire real auth provider claims (Auth.js/OAuth session) into auth-bridge issuance in production.

- App theming system: light/dark/theme packs, board backgrounds, and tile style presets.
- Color standards for boosts vs impediments:
  - Boost effects and tiles use green-forward accents.
  - Impediment effects and tiles use warm/red-forward accents.
- Sale item icon system:
  - Define a consistent icon palette and rarity colors for store packs/items.
  - Ensure WCAG contrast compliance for icon + label combinations.
- Replay and undo system:
  - Keep full step logs in exports so users can step forward/backward through any run.
  - Add a replay viewer that can load an exported game and scrub move-by-move.
  - Active-run controls policy:
    - During an active game, hide all options controls except `Export JSON`.
    - During an active game, visible controls should be:
      - `New Game`
      - `Undo`
      - `Export JSON`
  - Add limited undo in live play by difficulty:
    - `Normal`: 2 undos per run
    - `LTFG`: 1 undo per run
    - `Death by AI`: 0 undos per run
  - Support purchasable extra undo charges as boost inventory.
- Import/export and economy integrity:
  - Imported games are treated as `unranked` unless replay hash/signature validation passes.
  - Any replay that contains paid boosts/impediments must include entitlement metadata.
  - Ranked or leaderboard submissions require server-authoritative validation of moves, boosts, and inventory consumption.
- New impediment tile (`Lock-0`) for boost/impede economy:
  - Add an impediment tile that cannot be destroyed on consecutive turns.
  - Rule: it can only be destroyed every other turn (cooldown-gated destruction).
  - After cooldown is satisfied, collision behavior resolves like a `0` tile.
  - Include this in replay/event logs so ranked validation can verify cooldown timing.
- New seeded-chaos mode (`Bitstorm`):
  - Add a mode that starts from a pre-filled board instead of an empty grid.
  - Boards are generated from deterministic seeds to create repeatable challenge runs.
  - Mode name for branding: `Bitstorm` (chaos-style, but consistent with Binary-2048 theme).
  - Expose `Mode` as a dropdown in the gameplay controls row next to `Color`.
- UI controls governance (admin/dev toggle):
  - Add a dev/admin control policy to enable/disable individual dropdowns and advanced controls.
  - In `dev`, default all controls ON for rapid testing.
  - In `prod`, unauthenticated and unpaid users should see:
    - `New Game`
    - `Difficulty`
    - `Color`
    - `Mode`
    - `Import`
    - `Export`
  - Gameplay-state override:
    - If a run is active, temporarily suppress options/dropdowns per active-run controls policy.
- Input support and validation:
  - Movement input must support:
    - `W`, `A`, `S`, `D` keys
    - Arrow keys
    - Mobile swipe gestures
  - Keyboard controls should remain active alongside swipe (not mutually exclusive).
  - Add automated tests verifying all three input paths trigger correct movement behavior and direction mapping.
- AWS edge security and abuse controls:
  - Enable AWS WAF on CloudFront with:
    - IP-based rate limiting over 5-minute windows.
    - Geo blocking policy for unsupported regions.
    - Managed rule groups (baseline bot/reputation/common attack protections).
    - CAPTCHA/challenge gates for suspicious traffic patterns.
  - Add tiered request limits (higher limits for authenticated/paid users).
    - Test-backed policy helper implemented in `lib/binary2048/security-policy.ts` (`guest`, `authed`, `paid`).
  - Add billing tripwires (AWS Budgets + CloudWatch alarms) for request spikes and cost anomalies.
  - Emergency degrade toggles (heavy endpoint kill-switches):
    - `BINARY2048_DEGRADE_MODE=1` disables heavy endpoints globally.
    - `BINARY2048_DEGRADE_DISABLE_SIMULATE=1` disables `/api/simulate`.
    - `BINARY2048_DEGRADE_DISABLE_TOURNAMENT=1` disables `/api/bots/tournament`.
  - Follow [docs/load-shed-policy.md](./docs/load-shed-policy.md) for sustained latency/error events.
  - Use [docs/bot-abuse-incident-playbook.md](./docs/bot-abuse-incident-playbook.md) for incident detect/throttle/block/recover/postmortem workflow.
  - Use [docs/prelaunch-cost-simulation.md](./docs/prelaunch-cost-simulation.md) to define launch spend envelope and go/no-go gates.
  - Route 53 hardening:
    - Avoid wildcard DNS records unless required.
    - Add DNS query logging + anomaly alarms for NXDOMAIN/subdomain abuse patterns.
  - Track rollout in [docs/aws-waf-baseline.md](./docs/aws-waf-baseline.md).
  - Apply checklist in [docs/aws-waf-apply.md](./docs/aws-waf-apply.md).
  - Use concrete per-tier/per-endpoint limits from [docs/rate-limit-matrix.md](./docs/rate-limit-matrix.md).

## AI / Multibot Roadmap

### AI Chat Log Reconciliation (March 3, 2026)

- Replay as cornerstone (`ruleset + seed + moves`):
  - Status: `Completed (core)` / `Partial (shape)`
  - Notes:
    - Completed: deterministic replay metadata exists in exports (`rulesetId`, `engineVersion`, replay `seed` + `moves`, `spawnProbs`).
    - Partial: current export still includes full step snapshots (`before/after` states) for debuggability; compact replay-only export mode is not separated yet.
- Replay header + moves-only canonical object:
  - Status: `Partial`
  - Notes:
    - We already store equivalent fields, but naming differs from the proposed `ReplayHeader` (`replayVersion`, explicit `size`).
    - Add normalization helper to emit strict `{header,moves}` payload for share/replay APIs.
- Optional rich step log:
  - Status: `Completed (richer-than-proposed)`
  - Notes:
    - Events and per-step details are present.
    - Proposed optimization still open: compact step schema without full grids for production exports.
- `GET /api/games/:id/export`:
  - Status: `Completed`
- `POST /api/replay`:
  - Status: `Planned (next)`
- Shareable replay link (`/replay?code=...`):
  - Status: `Planned (next)`
- Seeded PRNG only (no `Math.random()` in move/spawn engine):
  - Status: `Completed` for gameplay RNG / `Partial` for seed generation
  - Notes:
    - Move/spawn logic uses deterministic seed + rngStep.
    - New game seed generation still uses `Math.random()` when seed is not provided (acceptable for random session start; can be swapped later).
- Fixed random draw count per spawn:
  - Status: `Partial`
  - Notes:
    - Spawn path is deterministic, but wildcard multiplier selection adds an extra random draw on wildcard spawns.
    - If strict fixed-count auditing is required, reserve fixed draw slots each spawn (even when branch is unused).
- Version pinning (`rulesetId` + `engineVersion`):
  - Status: `Completed`
- Storage strategy (light now, Mongo later):
  - Status: `Completed (light)` / `Planned (Mongo)`
  - Notes:
    - Current sessions are in-memory and replay payloads are self-contained.
    - Mongo storage plan remains for ranked/history features.
- Anti-cheat server-authoritative ranked flow:
  - Status: `Planned`
  - Notes:
    - Unranked integrity metadata is live (`created` vs `imported`).
    - Ranked validation + entitlement enforcement still belongs to auth/economy phase.

- Deterministic, replayable engine loop:
  - Keep engine pure and deterministic with seeded PRNG only.
  - Standardize step output shape for bot consumers:
    - `state` (next state)
    - `reward` (score delta)
    - `done`
    - `info` (`changed`, `spawned`, `events`, `illegalMove`)
- AI-friendly state encoding:
  - Add fixed-size encoded grid API using 2 channels per cell:
    - `type`: `0=empty`, `1=zero`, `2=number`, `3=wild`
    - `value`: bounded exponent form (`log2` for numbers, multiplier exponent for wildcards)
- Rules/version pinning for reproducible bot evaluation:
  - Include and export `rulesetId`, `engineVersion` (commit SHA), and spawn probabilities.
- Legal move support and no-op policy:
  - Add `legalMoves(state)` and/or expose `changed=false` on no-op moves.
  - Define training policy for no-op moves (penalize or disallow).
- Batch simulation endpoint for scale:
  - Add `POST /api/simulate` to run many moves in one request with seed + config.
  - Return final state/score and optional step summaries for rollouts and MCTS.
- Multibot hooks and runner:
  - Bot contract: input `{ encodedState, legalMoves, meta }`, output `{ action }`.
  - Match runner modes: AI vs AI (same seed), AI vs replay, tournament brackets.
  - Support formats: same-seed race, best-of-N seeds, per-move time budget.
- Reward-shaping telemetry (optional):
  - Track auxiliary metrics such as max tile, empty-cell count, monotonicity, and zero-pressure penalties.
- Near-term API increments (without major re-architecture):
  - `GET /api/games/:id/encoded` -> encoded state + legal moves
  - `POST /api/games/:id/move` -> include `changed`, `reward`, `spawned`, `done`
  - `POST /api/simulate` -> seed + moves + config -> final state/score
  - `GET /api/games/:id/export` -> include replay-critical data (`seed`, `moves`, versions)
- Open product decision:
  - Confirm multibot scope for implementation order:
    - bot swarm/self-play tournaments
    - external integration bots (Discord/Slack)
    - project-specific custom meaning
