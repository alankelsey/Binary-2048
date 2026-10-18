# V2 Phase 3 session step compaction — 2026-10-18

Status: complete. The broader recovery/schema migration item remains open.

## Retention boundary

Session schema version 2 stores each accepted command as only `turn`, `dir`,
and `moved`. Version 1 retained complete `before` and `after` game states plus
events in every `session.steps` entry. The active session still stores its
initial and current states, and it retains at most the remaining undo allowance
as full states. Normal mode therefore keeps no more than two undo states;
zero-undo modes keep none.

A 275-command deterministic measurement produced these serialized sizes:

- previous full-step shape: 254,601 bytes;
- schema-v2 compact session: 12,326 bytes; and
- retained size: 4.84%, a 95.16% reduction.

The measurement includes the initial/current states and bounded undo states,
so it reflects the whole stored session rather than comparing isolated step
objects. No complete board remains inside `session.steps`.

## Replay, export, undo, and integrity

Move handling returns the just-computed full step to the response without
persisting it. Undo restores from the bounded `undoStates` stack and removes
the matching compact command. Leaderboard moved-step accounting continues to
use the compact `moved` flag.

Full exports, replay logs, audit chains, and import responses materialize the
full deterministic steps from the initial state and compact directions only
when those optional paths are requested. Ordinary moves and periodic signed
checkpoints read directions directly and do not replay the session. Signed
recovery, compact tails, turn/hash guards, duplicate prevention, FIFO ordering,
and ranked integrity are unchanged.

## Compatibility and migration

Existing unversioned sessions are read as the legacy full-step shape. The
reader deterministically replays their directions, replaces the in-memory
history with schema-v2 compact records, and reconstructs only the remaining
bounded undo states. The next successful mutation persists schema version 2
using the existing optimistic revision, so lazy migration cannot bypass
conflict detection.

Recovery snapshot version 1 and full export version 1 remain unchanged.
Import endpoints still return materialized full steps for API compatibility.
The separate Phase 3 schema/version migration item remains open for broader
version negotiation, malformed-v2 handling, and future recovery formats.

## Acceptance evidence

- A legacy full-step fixture migrates on read and materializes byte-for-byte
  equivalent deterministic steps.
- A 275-command session stays below 20% of its legacy serialized size, exports
  all 275 full steps, round-trips through signed recovery, and retains undo.
- The import route accepts and returns a 250-command recovery while the stored
  session contains 250 compact records and no per-step boards.
- Browser acceptance starts at turn 250, paints turn 251 locally, and sends the
  same compact turn/hash request without recovery history.
- Existing move, undo, export, replay audit, leaderboard, and recovery suites
  remain covered.

## Validation

- Full unit suite: 168 suites, 609 tests passed.
- Full local browser suite: 69 tests passed, 1 diagnostics-only test skipped.
- TypeScript and optimized production compilation passed.

Deployment and production-smoke results are recorded after release.
