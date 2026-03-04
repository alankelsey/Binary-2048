# Binary-2048 Replay Storage Strategy

## Goal

Keep replay persistence lightweight by default (no database requirement), while defining a clean migration path to MongoDB for ranked, contest, and audit workloads.

## Phase 1: No-DB Default (Current Lightweight Mode)

- Share links:
  - Inline replay codes (`r1.` / `r1z.`) when payload is short enough.
  - Short-lived hosted replay tokens (`rs1.`) for oversized payloads.
- Export source of truth:
  - Deterministic replay header (`replayVersion`, `rulesetId`, `engineVersion`, `size`, `seed`, `createdAt`)
  - Move list
  - Optional step log metadata (`rngStepStart`, `rngStepEnd`, event summaries)
- Leaderboard minimal fields:
  - `seed`
  - `moves` (or compact encoding)
  - `engineVersion`
  - `rulesetId`
  - `finalStateHash`
  - `signature` for ranked submissions when configured

## Phase 2: Mongo Replay Persistence (Top Scores + Contests)

- `replays` collection:
  - `replayId`, `userId`, `rulesetId`, `engineVersion`, `seed`, `size`, `createdAt`
  - `movesCompressed` (base64url/deflate)
  - `moveCount`
  - `finalStateHash`
- `replay_steps` collection (optional, selective):
  - Persist only for:
    - contest finalists
    - moderation/audit disputes
    - anti-cheat flagged sessions
  - Fields: `replayId`, `idx`, `dir`, `spawn`, `events`, `scoreDelta`, `scoreTotal`, `rngStepStart`, `rngStepEnd`
- `leaderboard_entries` link:
  - Store `replayId` pointer instead of duplicating large replay blobs

## Retention

- No-DB hosted replay tokens (`rs1.`): short TTL only.
- Mongo replays:
  - Top leaderboard runs: long retention
  - Non-top ranked runs: rolling retention window
  - Full step logs: shortest retention unless under active dispute

## Migration Path

1. Keep current no-DB replay flow as default.
2. Introduce storage adapter interface (`none` vs `mongo`).
3. Enable Mongo storage first for ranked submissions and contests.
4. Backfill top historical runs from exported payloads when needed.
5. Add ops metrics:
   - replay decode latency
   - replay storage size growth
   - replay retrieval error rates

