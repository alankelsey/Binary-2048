# V2 Phase 2 turn and state-hash reconciliation — 2026-10-16

Status: complete for versioned casual acknowledgement reconciliation. Retry,
offline continuation, and unrecoverable-divergence product policy remain open.

## Identity contract

`lib/binary2048/state-identity.ts` defines state-hash version
`fnv1a32-game-state-v2`. Its canonical UTF-16/JSON input has fixed field order
and includes:

- game config: dimensions, seed, win tile, zero behavior, no-op spawn behavior,
  spawn probabilities, and wildcard multipliers;
- state dimensions, seed, RNG step, score, turn, won, and over flags; and
- the row-major grid with exact null, number, zero, wildcard multiplier, and
  Lock-0 values.

The session ID is excluded because recovery may issue a replacement ID without
changing deterministic gameplay state. FNV-1a 32-bit produces an eight-character
lowercase hexadecimal identity. It is a fast deterministic divergence signal,
not a cryptographic integrity or authorization mechanism. The authoritative
state and signed recovery paths retain their existing security roles.

The canonical serializer is shared by browser prediction, move responses,
encoded bot responses, and server precondition checks. Game rules remain solely
in the engine.

## Wire protocol and compatibility

New normal-game move requests send:

- `expectStateHashVersion: "fnv1a32-game-state-v2"`; and
- `expectStateHash`, calculated from the acknowledged pre-move state.

Successful move and encoded-state responses return `stateHashVersion` and
`stateHash`. An explicitly unsupported request version returns HTTP 400 before
session mutation and names the supported version. A versioned stale precondition
continues to return HTTP 409.

For compatibility, a request that supplies `expectStateHash` without a version
may match either V2 or the preserved legacy V1 calculation. This keeps existing
bot and research clients working during migration. Every response advertises
V2, so updated clients can stop relying on inference.

## Client classification

Each pending prediction stores its expected post-move turn and V2 state hash.
An acknowledgement is classified in this order:

1. `unsupported_hash_version` when the response version is absent or unknown;
2. `stale_response` when its turn precedes the last acknowledged turn;
3. `turn_mismatch` when its turn differs from that command's predicted turn;
4. `state_hash_mismatch` when the advertised hash differs from either the
   predicted hash or a fresh hash of the returned authoritative state; or
5. `match`.

Stable command identity and FIFO order remain separate hard invariants. A match
advances acknowledgement once and recomputes the pending tail from the returned
state. Ranked play still bypasses local prediction and renders the server state.

## Temporary fail-closed behavior

Until the next Phase 2 policy item is decided:

- turn, hash, or version divergence accepts the returned authoritative board,
  clears queued predictions, and shows a bounded synchronization message;
- a stale response is ignored, queued predictions are cleared, the last
  acknowledged board is restored, and the player is asked to reload; and
- an HTTP failure, including the server's pre-move 409 guard, retains the prior
  rollback behavior.

The behavior prevents additional moves from draining through an unverified
base. It does not yet define automatic retry, offline continuation, conflict
recovery, or when divergence becomes unrecoverable. The corresponding plan item
remains unchecked.

## Evidence

Unit coverage proves canonical stability and sensitivity across config, RNG,
score, turn, terminal flags, and tile state; legacy unversioned compatibility;
server version validation before mutation; and all five client classifications.

Browser coverage proves that a matching acknowledgement retains immediate local
paint and that an injected authoritative hash divergence clears the queued tail,
renders the server board, reports `state_hash_mismatch` in bounded performance
evidence, and does not send the next request. Existing queue, no-op, rapid-input,
terminal, failure, new-game, and ranked boundaries remain covered.

## Validation

- Focused identity, prediction, telemetry, AI, and route suites: 6 suites,
  49 tests passed after final correction.
- Focused reconciliation and queue browser set: 11 tests passed after final
  correction.
- Full unit suite: 164 suites, 582 tests passed.
- Full UI suite: 62 tests passed, with the expected diagnostics-only skip.
- TypeScript check: passed.
- Optimized production compilation: passed. The local post-build smoke reached
  the expected environment boundary because the auth-bridge secret is absent;
  `/api/auth/bridge-token` returned 503 instead of the configured production
  unauthenticated 401. Deployment smoke is recorded after release.
