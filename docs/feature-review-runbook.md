# Binary-2048 Feature Review Runbook

Use this checklist to verify behavior before final roadmap closeout.

## 0) Prep

- [ ] Pull latest `main`
- [ ] Install deps
- [ ] Start app

```bash
git pull
npm install
npm run dev
```

Optional (separate terminal):

```bash
npm run test:unit
```

## 1) Core Game Engine + Replay

### Deterministic engine and spawn contract
- [ ] Validate deterministic simulation behavior

```bash
npm run test:unit -- lib/binary2048/engine.rng-contract.test.ts lib/binary2048/simulate.test.ts
```

### Export metadata correctness
- [ ] Confirm exports include ruleset/engine/spawn metadata

```bash
npm run test:unit -- lib/binary2048/export-meta.test.ts app/api/games/[id]/export/route.test.ts
```

### Replay reconstruction/validation/signing
- [ ] Confirm replay payloads validate and reconstruct deterministically

```bash
npm run test:unit -- \
  lib/binary2048/replay.test.ts \
  lib/binary2048/replay-validate.test.ts \
  lib/binary2048/replay-signature.test.ts \
  app/api/replay/route.test.ts \
  app/api/replay/validate/route.test.ts
```

### Replay code + hosted fallback
- [ ] Confirm encode/decode and oversized replay fallback

```bash
npm run test:unit -- \
  lib/binary2048/replay-code.test.ts \
  lib/binary2048/replay-hosted-code.test.ts \
  app/api/replay/code/route.test.ts
```

## 2) Gameplay UX

### Input and controls
- [ ] Arrow keys + WASD mapping tests pass

```bash
npm run test:unit -- lib/binary2048/input.test.ts
```

- [ ] In browser, verify:
  - [ ] Arrow keys move tiles
  - [ ] WASD moves tiles
  - [ ] Swipe works on mobile viewport

### Undo and active-run controls
- [ ] Undo tests pass

```bash
npm run test:unit -- lib/binary2048/sessions.test.ts app/api/games/[id]/undo/route.test.ts lib/binary2048/control-visibility.test.ts
```

- [ ] In browser, verify:
  - [ ] Undo button appears during active run
  - [ ] Undo count decrements only when undo is used
  - [ ] Non-active options visibility behavior matches policy

### Win/game-over/replay UI
- [ ] Overlay and replay control tests pass

```bash
npm run test:unit -- \
  lib/binary2048/game-overlays.test.ts \
  lib/binary2048/replay-autoplay.test.ts \
  lib/binary2048/replay-scrubber.test.ts \
  lib/binary2048/replay-exit.test.ts
```

- [ ] In browser, verify:
  - [ ] Win overlay clearly shown
  - [ ] Continue/New Game actions work
  - [ ] Replay step, play/pause, speed, scrubber all work

### Theme/mobile/accessibility
- [ ] Theme/mobile/accessibility tests pass

```bash
npm run test:unit -- \
  lib/binary2048/theme.test.ts \
  lib/binary2048/mobile-layout.test.ts \
  lib/binary2048/accessibility-map.test.ts
```

- [ ] In browser, verify:
  - [ ] Theme dropdown changes visual theme
  - [ ] Mobile layout keeps board and controls usable
  - [ ] Keyboard tab order is usable end-to-end

## 3) Tile Rules + Modes

### Zero/wild/lock tile behavior
- [ ] Tile rule tests pass

```bash
npm run test:unit -- \
  lib/binary2048/engine.zero-rules.test.ts \
  lib/binary2048/engine.lock0.test.ts \
  lib/binary2048/cell-effects.test.ts
```

### Bitstorm mode
- [ ] Bitstorm tests pass

```bash
npm run test:unit -- lib/binary2048/engine.bitstorm.test.ts
```

- [ ] In browser, verify:
  - [ ] Classic starts with 2 spawned tiles
  - [ ] Bitstorm starts from seeded pre-filled board

## 4) Economy, Ranked Integrity, Auth

### Auth bridge and entitlement proofs
- [ ] Auth/entitlement tests pass

```bash
npm run test:unit -- \
  lib/binary2048/auth-bridge.test.ts \
  lib/binary2048/auth-context.test.ts \
  lib/binary2048/entitlement-proof.test.ts \
  app/api/auth/bridge-token/route.test.ts \
  app/api/auth/entitlements/proof/route.test.ts
```

### Leaderboard integrity and eligibility
- [ ] Ranked leaderboard tests pass

```bash
npm run test:unit -- \
  lib/binary2048/leaderboard.test.ts \
  lib/binary2048/leaderboard-eligibility.test.ts \
  app/api/leaderboard/submit/route.test.ts
```

### Store and purchase pipeline
- [ ] Store tests pass

```bash
npm run test:unit -- \
  lib/binary2048/store-catalog.test.ts \
  lib/binary2048/inventory.test.ts \
  lib/binary2048/store-webhook.test.ts \
  app/api/store/catalog/route.test.ts \
  app/api/store/inventory/route.test.ts \
  app/api/store/consume/route.test.ts \
  app/api/store/purchase/route.test.ts \
  app/api/store/webhook/route.test.ts
```

## 5) Bots, Async PvP, Subscriptions, Marketing

### Tournament orchestration + limits
- [ ] Bot/tournament tests pass

```bash
npm run test:unit -- \
  lib/binary2048/bot-orchestrator.test.ts \
  lib/binary2048/tournament-queue.test.ts \
  lib/binary2048/rate-limit.test.ts \
  app/api/bots/tournament/route.test.ts
```

### Async same-seed PvP
- [ ] Async PvP tests pass

```bash
npm run test:unit -- \
  lib/binary2048/async-pvp.test.ts \
  app/api/matches/same-seed/route.test.ts \
  app/api/matches/[id]/route.test.ts \
  app/api/matches/[id]/submit/route.test.ts
```

### Subscriptions + marketing
- [ ] Subscription and marketing tests pass

```bash
npm run test:unit -- \
  lib/binary2048/subscriptions.test.ts \
  lib/binary2048/feature-gating.test.ts \
  lib/binary2048/marketing.test.ts \
  lib/binary2048/share.test.ts \
  app/api/subscriptions/route.test.ts \
  app/api/marketing/track/route.test.ts \
  app/api/marketing/events/route.test.ts
```

## 6) Docs + API Contract + Privacy

### OpenAPI/docs consistency
- [ ] API docs tests pass

```bash
npm run test:unit -- \
  lib/binary2048/openapi.test.ts \
  lib/binary2048/openapi-docs.test.ts \
  lib/binary2048/docs-content.test.ts \
  app/api/openapi/route.test.ts
```

### Privacy endpoints
- [ ] User data export/delete tests pass

```bash
npm run test:unit -- app/api/user/data/export/route.test.ts app/api/user/data/route.test.ts
```

## 7) Smoke and Release Confidence

- [ ] Full build + smoke passes

```bash
npm run build
```

- [ ] Full aggregate test pass (optional long run)

```bash
npm run test:all
```

## 8) GitHub Pages Check

- [ ] Confirm workflow file exists: `.github/workflows/github-pages.yml`
- [ ] Confirm static page exists: `gh-pages/index.html`
- [ ] Enable Pages source to `GitHub Actions` in repo settings
- [ ] Verify deployed Pages URL loads and shows embed/fallback link

## 9) Remaining Roadmap Item (Manual AWS)

- [ ] WAF live association + production verification completed
  - `DIST_ID=<id> npm run ops:waf:verify`
  - `DIST_ID=<id> npm run ops:waf:check`
  - `DIST_ID=<id> APP_DOMAIN=binary2048.com npm run ops:waf:smoke`

When this final section is complete, mark the last roadmap checkbox in:
- `docs/roadmap-checklist.md`
