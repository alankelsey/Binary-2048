# V2 Phase 7 user-authored ranked exclusion evidence

Date: 2026-10-27 America/Boise

Status: complete.

## Integrity boundary

- Sessions now carry server-derived board provenance in integrity metadata:
  `canonical` or `user_authored`.
- `POST /api/games` derives `user_authored` whenever the request supplies an
  initial board. It does not trust a client-provided claim. Ranked creation
  continues to reject all supplied initial boards before a session is created.
- Board provenance is stored with the session, returned by the game API, and
  included in signed recovery snapshots. Changing that provenance invalidates
  the recovery signature and downgrades recovery to an unranked import.

## Leaderboard policy

- Ranked eligibility explicitly rejects `user_authored` board provenance even
  when a board has two occupied cells and otherwise resembles a canonical
  ranked start.
- This check is defense in depth behind the ranked game-creation restriction,
  and it applies again after trusted recovery.
- No competition approval exception exists yet. A future competition feature
  must define the approved scenario identity and verify its signature on the
  server before changing this fail-closed eligibility policy.

## Verification

- Game-route tests cover canonical provenance and server-derived user-authored
  provenance on both the session response and recovery snapshot.
- Eligibility tests cover a two-cell user-authored board that would bypass the
  older occupied-cell-count check.
- Recovery tests cover provenance preservation and signature-bound tamper
  rejection.
