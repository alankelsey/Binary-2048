# V2 Phase 2 browser engine interface evidence — 2026-10-15

Status: complete for the browser-safe engine-interface item. Local optimistic
mutation remains intentionally disabled until the later prediction-state and
reconciliation work is implemented.

## Boundary decision

`lib/binary2048/browser-engine.ts` is the only browser prediction entry point.
It calls the existing canonical `applyMove` implementation directly, so move,
merge, special-tile, spawn, score, win, and loss rules have one implementation.
The server continues to call the same `applyMove` function through
`moveSession`; the adapter does not replace the authoritative session or
persistence path.

The interface is synchronous and contains no network, authentication, storage,
clock, or DOM dependency. Its input is:

- protocol version `1`;
- ruleset ID `binary2048-v1`;
- a complete last-known `GameState`, including config, seed, and RNG step; and
- one direction.

Its output repeats the protocol version, ruleset, direction, and base turn, then
returns the canonical next state, `moved` decision, and events. Unknown protocol
versions and rulesets fail closed. The adapter clones mutable state at the
boundary, including the terminal/no-op case where the canonical engine may
return its input, so prediction cannot mutate or retain the caller's state.

The contract is deterministic: an identical state and direction must produce
identical state, movement status, and events through the adapter and the server
engine. IDs and initial seeds are established before this boundary; prediction
does not generate either.

## Bundle constraint

The adapter must bundle as browser ESM with no Node or package dependency. The
automated esbuild assertion caps its minified bundle at 24 KiB to make accidental
server-only imports fail review. The accepted bundle is 4,869 bytes and contains
only the adapter and canonical engine source.

## Parity evidence

The focused suite passes eight tests. It compares 24 consecutive moves for each
of four seeds, exercises number, zero, wildcard, and Lock-0 tiles, covers no-op
and terminal boundaries, proves input/reference isolation, verifies fail-closed
version handling, and checks the browser bundle constraint. Each predicted step
is compared with a direct canonical-engine step using the full state, movement
status, and event list.

The production UI still waits for the server response and does not import this
adapter. The next Phase 2 slice must define predicted, acknowledged, and pending
state ownership before using the interface for local paint. Turn/hash
reconciliation, rollback, retry, offline, divergence, and ranked behavior remain
open plan items.

## Validation

- Focused parity and bundle suite: 1 suite, 8 tests passed.
- Minified browser ESM: 4,869 bytes; no Node or third-party inputs.
- Full unit suite: 162 suites, 563 tests passed.
- TypeScript check: passed.
- Optimized production compilation: passed. The local post-build smoke reached
  the expected environment boundary because the auth-bridge secret is absent;
  `/api/auth/bridge-token` returned 503 instead of the configured production
  unauthenticated 401.
- Runtime commit `7d27373` deployed successfully in Amplify job 389, whose
  recorded commit was `7d273733de40d7f2f34d463fee1a8926977348d5`.
- Production smoke against `https://www.binary2048.com`: passed after job 389.
