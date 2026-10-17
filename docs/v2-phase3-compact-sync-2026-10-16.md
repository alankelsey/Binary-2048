# V2 Phase 3 compact move synchronization — 2026-10-16

Status: complete for compact normal move traffic and periodic signed recovery
checkpoints. Durable checkpoint-plus-tail persistence remains the next Phase 3
item.

## Protocol

`turn-hash-checkpoint-v1` is an opt-in move protocol. A compact request sends:

- `dir` or `action`;
- `syncVersion: "turn-hash-checkpoint-v1"`;
- `expectTurn`, the turn from the last authoritative acknowledgement; and
- the existing `expectStateHashVersion` and `expectStateHash` precondition.

The server verifies the session, turn, and hash before mutation. A successful
compact response always includes the authoritative fixed-size game state,
post-move hash/version, move outcome, undo metadata, integrity data, and a
`sync` envelope. It omits `recoverySnapshot` between checkpoints.

The server emits a signed recovery checkpoint after every 25 persisted move
records, after a recovery import, and at terminal state. Cadence is based on
persisted records rather than game turn because a legal no-op command can leave
the deterministic turn unchanged. The envelope exposes `checkpoint`,
`checkpointStep`, and the interval so clients can distinguish normal compact
acknowledgements from checkpoint responses.

## Compatibility and recovery boundary

Requests without `syncVersion` retain the legacy response, including the full
recovery snapshot on every move. Unknown compact versions return HTTP 400
without mutation. A compact turn mismatch returns HTTP 409 without mutation.
OpenAPI and README document both paths.

The game creation, import, undo, export, replay, signed-recovery, ranked
eligibility, hash precondition, and duplicate-acknowledgement paths retain
their existing behavior. The browser sends a recovery snapshot only after a
404 triggers the existing recovery path, so ordinary move traffic no longer
reads or sends full local history.

Until the next Phase 3 item persists a last acknowledged checkpoint plus a
bounded pending tail, a compact client holds only its latest server checkpoint.
If the server is lost before the next checkpoint, recovery from local storage
can restore only that checkpoint. This bounded recovery window is intentional
and documented; it does not change the legacy-client recovery path. The next
slice closes it with a versioned durable tail rather than restoring full history
to every normal request.

## Size evidence

Route coverage advances 26 compact requests. Non-checkpoint request bodies vary
by fewer than 8 bytes (only numeric field width changes). Non-checkpoint
responses remain below 3 KB and vary by fewer than 256 bytes despite board and
event changes. The 25th persisted move returns the signed recovery checkpoint;
it is the only full-history response in that sequence. This proves ordinary
traffic is effectively constant between checkpoints while retaining a bounded
recovery artifact.

## Acceptance evidence

Unit and route coverage proves:

- exact compact-version validation and no mutation for unknown versions;
- turn mismatch rejection before mutation;
- versioned hash precondition preservation;
- periodic signed checkpoint emission at persisted step 25;
- compact omission of recovery history between checkpoints;
- legacy unversioned full-snapshot responses; and
- browser normal-move requests carry the compact version and turn guard without
  sending `recoverySnapshot`.

## Validation

- Full unit suite: 165 suites, 593 tests passed.
- Full local browser suite: 67 tests passed, 1 diagnostics-only test skipped.
- Optimized production compilation and TypeScript validation: passed.
- Existing lint warnings in `app/page.tsx`, `ghost-race.ts`, and
  `training-data.ts` were unchanged and do not block the build.

## Release verification

- Runtime commit `927fa8e` deployed through Amplify job 399 successfully.
- Non-mutating production smoke checks passed against
  `https://www.binary2048.com`.
