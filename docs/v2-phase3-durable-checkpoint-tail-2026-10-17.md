# V2 Phase 3 durable checkpoint and pending tail — 2026-10-17

Status: complete for the durable recovery format. Lifecycle write scheduling
and storage corruption/regression flush policy remain separate Phase 3 work.

## Durable format and limits

The browser stores `checkpoint-tail-v1` in the existing resume-storage key.
It contains a server-signed `SessionRecoverySnapshot`, an acknowledged tail of
at most 24 directions, and a pending tail of at most nine directions: one
active command and the existing eight-command FIFO buffer. It never stores a
growing full history between server checkpoints.

A checkpoint replaces the acknowledged tail. Between checkpoints, each verified
acknowledgement appends its direction to that tail. The active and queued
directions are saved only after their local prediction has painted, then are
replaced after the authoritative acknowledgement. Writes therefore do not delay
input capture or the first local paint.

Malformed records, unknown versions, invalid directions, and oversized tails
are ignored. The previous legacy resume envelope remains readable for existing
clients. The browser does not trust a client-built full snapshot to extend a
signed checkpoint.

## Recovery and integrity

On a move, undo, or export 404, the browser sends the compact recovery payload
instead of a reconstructed full history. The server requires a configured
recovery secret and a valid checkpoint signature, restores the checkpoint,
then replays only the acknowledged tail. This retains the checkpoint's
integrity class, undo state, and session id. A failed verification returns a
400 and does not silently downgrade ranked play.

On browser startup, the same compact payload restores the acknowledged state.
The stored pending directions are then submitted in their original FIFO order.
The server remains authoritative: normal state-hash and turn guards apply to
each resumed move, and a mismatch follows the existing fail-closed policy.

The storage update after local paint is synchronous because `localStorage` has
no transactional asynchronous primitive. The next Phase 3 item will move these
writes out of the move lifecycle using coalescing and lifecycle flushing, while
preventing stale flushes from overwriting a newer checkpoint.

## Acceptance evidence

- Storage tests cover version validation, legacy separation, malformed data,
  and the 24-command acknowledged / 9-command pending bounds.
- Import and move-route tests prove a missing session restores from a signed
  checkpoint plus tail, preserves integrity, emits a new checkpoint, and
  rejects unsigned compact recovery.
- Browser coverage proves compact acknowledgements persist a bounded tail and
  a 404 retry sends the checkpoint plus acknowledged/pending tails without a
  full recovery snapshot.

## Validation

- Full unit suite: 166 suites, 600 tests passed.
- Full local browser suite: 68 tests passed, 1 diagnostics-only test skipped.
- TypeScript check: passed.

## Release verification

- Runtime commit `eecfe14` deployed through Amplify job 401 successfully.
- Non-mutating production smoke checks passed against
  `https://www.binary2048.com`.
