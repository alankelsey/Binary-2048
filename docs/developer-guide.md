# Binary-2048 Developer Guide

## Local Setup

```bash
npm install
npm run dev
```

Key local URLs:

- App: `http://localhost:3000`
- OpenAPI JSON: `http://localhost:3000/api/openapi`
- API docs UI: `http://localhost:3000/api-docs`
- Replay viewer (share links): `http://localhost:3000/replay?code=...`

## Architecture Overview

- Next.js App Router app.
- Game engine and rules in `lib/binary2048/engine.ts`.
- Session orchestration in `lib/binary2048/sessions.ts`.
- API routes in `app/api/**`.
- OpenAPI source in `lib/binary2048/openapi.ts`.

## Replay Model

- Deterministic replay based on:
  - Seed
  - Move sequence
  - Locked replay header fields
- Header lock enforces:
  - `replayVersion`
  - `rulesetId`
  - `engineVersion`
  - `size`
  - `seed`
  - `createdAt`
- Export metadata includes normalized `stepLog` with:
  - `rngStepStart`/`rngStepEnd`
  - `scoreDelta`/`scoreTotal`
  - normalized event payloads

Replay storage phases and migration notes are documented in:

- `docs/replay-storage-strategy.md`

## API Surface (High Use)

- Game lifecycle:
  - `POST /api/games`
  - `GET /api/games/:id`
  - `POST /api/games/:id/move`
  - `POST /api/games/:id/undo`
- Replay:
  - `GET /api/games/:id/export`
  - `GET /api/games/:id/replay`
  - `POST /api/replay`
  - `POST /api/replay/postmortem`
  - `POST/GET /api/replay/code`
- Daily challenge:
  - `GET /api/challenges/daily`
  - `POST /api/challenges/daily/submit`
- AI:
  - `GET /api/games/:id/encoded`
  - `POST /api/simulate`
  - `POST /api/bots/tournament`
- Economy/Auth:
  - `POST /api/auth/dev-token`
  - `POST /api/auth/entitlements/proof`
  - `POST /api/leaderboard/submit`
  - `GET /api/leaderboard`

See `/api/openapi` for up-to-date route definitions.

## Testing

```bash
npm run test:unit
npm run test:all
```

Current suite includes:

- Engine rule tests
- Replay parsing/audit and schema lock tests
- API route tests
- Bot orchestration tests

## Environment Notes

- Dev auth helper requires:
  - `BINARY2048_ENABLE_DEV_AUTH_TOKEN=1`
  - `BINARY2048_AUTH_BRIDGE_SECRET`
- Replay code signing:
  - `BINARY2048_REPLAY_CODE_SECRET`
- Entitlement proof flow:
  - `BINARY2048_ENTITLEMENT_SECRET`

## Operational Pointers

- WAF helpers and templates live in `docs/` + `scripts/`.
- Use `npm run roadmap:status` to check roadmap progress.
- Keep `tsconfig.json` stable (avoid committing transient `.next-dev-####` paths).
- Bot integration docs:
  - `docs/bot-api-quickstart.md`
  - `docs/bot-benchmark-suite.md`
  - `docs/mongo-migration-triggers.md`
