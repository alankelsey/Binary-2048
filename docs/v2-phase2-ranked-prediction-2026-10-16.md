# V2 Phase 2 ranked prediction decision — 2026-10-16

Status: accepted. Connected ranked play uses immediate local paint with strict
authoritative acknowledgement. Phase 2 is complete.

## Decision

Ranked prediction is safe to ship within the existing deterministic protocol.
The browser already receives the complete current state, configuration, seed,
and RNG position required to render the board. Running the same canonical move
locally does not grant authority or reveal state that the client did not already
possess. Ranked eligibility, score submission, economy rules, terminal state,
signed recovery, and the durable session continue to derive from the server.

The client therefore paints a ranked move through the same browser-safe engine
and acknowledged/predicted/pending model used by casual play. Every request
carries the acknowledged pre-move version and state hash. The next server
response must match the predicted turn and canonical state hash before the
acknowledgement advances and the pending tail rebases.

## Stricter ranked boundaries

Ranked prediction differs from casual continuation at failure boundaries:

- an input captured while the browser reports offline is classified
  `ranked_offline`; it produces no prediction, queue entry, or request;
- the transport remains serial with one active plus eight pending commands;
- a network/502/503/504 failure may use the existing single 250 ms retry, but
  retry exhaustion rolls back and blocks further ranked moves until reload or
  New Game because delivery may be ambiguous;
- HTTP 409 is not replayed and may resolve only through one authoritative read;
- a matching authoritative read can acknowledge an already-applied duplicate;
- stale, turn-mismatched, hash-mismatched, or unsupported-version responses
  clear the tail, adopt only the safe authoritative boundary, and block further
  ranked input until reload or New Game; and
- recovery imports retain their existing signature checks. A modified snapshot
  is still downgraded to unranked by the server and cannot preserve ranked
  eligibility.

These rules improve ranked input-to-paint latency without allowing local state
to determine a ranked result. They also avoid offline ranked tails, whose timing
and delivery semantics would create a larger integrity and abuse surface.

## Abuse and authority analysis

A modified client can already submit arbitrary directions and calculate future
deterministic states. Prediction adds no trusted claim to the protocol. The
server independently loads the ranked session, checks the pre-move state hash,
applies the direction through the canonical engine, persists the result, and
returns its own state identity. Leaderboard submission remains derived from the
server session and its ranked-created integrity metadata.

Queue capacity, rate limiting, authentication, entitlement verification, and
server-side ranked configuration remain unchanged. Client command IDs organize
local FIFO state only; they are not authorization or scoring evidence.

## Acceptance evidence

Focused browser coverage proves:

- a delayed ranked response leaves the predicted board painted while the
  request is pending, then records a matching reconciliation;
- injected authoritative divergence adopts the returned board, clears the tail,
  blocks the next ranked input, and issues no second request; and
- browser offline mode rejects a ranked move without changing the board or
  issuing a request, with a visible connection requirement and classified drop.

The existing casual tests continue to prove immediate paint, ordered
acknowledgement, retry exhaustion rollback, duplicate acknowledgement, bounded
offline FIFO continuation, and divergence handling.

## Validation

- Focused Phase 2 browser suite: 9 tests passed.
- Focused prediction/performance unit set: 2 suites, 18 tests passed.
- Full unit suite: 164 suites, 586 tests passed.
- Full UI suite: 67 tests passed, with the expected diagnostics-only skip.
- TypeScript check: passed.
- Optimized production compilation: passed. The local post-build smoke reached
  the expected environment boundary because the auth-bridge secret is absent;
  `/api/auth/bridge-token` returned 503 instead of the configured production
  unauthenticated 401.
- Roadmap progress after Phase 2 completion: 336/362 (93%). V2 progress: 22/84
  (26.2%).
- Runtime commit `c2230fa` deployed successfully in Amplify job 397, whose
  recorded commit was `c2230fa92edeb6d3a2b64bf86fd3f82a00ccf0f6`.
- Production smoke against `https://www.binary2048.com`: passed after job 397.
