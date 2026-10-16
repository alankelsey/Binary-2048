# V2 Phase 2 local prediction evidence — 2026-10-16

Status: complete for casual local paint and explicit acknowledged, predicted,
and pending state ownership. Turn/hash comparison and broader divergence,
retry, and offline policy remain open Phase 2 work.

## State ownership

`lib/binary2048/client-prediction.ts` owns the client prediction model:

- `acknowledged` is the latest complete state accepted from the server;
- `predicted` is the board rendered for a casual game; and
- `pending` is the ordered identity and direction of each locally applied move
  that the server has not acknowledged.

Every prediction calls the versioned browser engine interface, which calls the
canonical deterministic engine. The model contains no game-rule copy. A server
response must acknowledge the first pending command identity. It advances the
acknowledged state, removes that command exactly once, and deterministically
replays the remaining pending tail from the authoritative response.

The React shell keeps the acknowledged state separately from the rendered
predicted state. Score and board movement paint from prediction, while terminal
status, terminal overlays, and durable high score advance from acknowledgement.
Undo, restored/imported sessions, new games, tutorial entry, and ranked server
responses replace both state branches at their explicit boundaries.

## Input, paint, and transport

Casual keyboard, touch, and opt-in direction-control commands retain the Phase
1 FIFO contract: one active request plus at most eight buffered commands. Each
accepted command runs the browser engine immediately, joins the pending model,
and updates the rendered board. The active request waits for the predicted React
commit and next animation frame, so its move fetch cannot begin before the local
paint. Transport remains serial; queued commands do not create concurrent
requests.

The move performance trace now records local-engine start/end, local predicted
paint, and a measured local-engine duration. Ranked play records
`localEngineStatus: not_run` and remains server-rendered after acknowledgement.

## Boundary behavior

- A successful casual response becomes the new acknowledged state and rebases
  the pending tail without applying the acknowledged command twice.
- A failed active request drops the buffered commands and rolls the rendered
  board back to the last acknowledged snapshot.
- An acknowledged terminal response drops the remaining queue and renders the
  authoritative terminal state.
- Starting or loading another game creates a fresh model, preventing commands
  from crossing session IDs.
- Replay suppresses game terminal overlays from the underlying acknowledged
  session.

This is the first reconciliation boundary, but it does not yet compare an
authoritative state hash, classify divergence, retry failed commands, or define
offline continuation. Those remain explicit unchecked plan items.

## Acceptance evidence

The Phase 2 Playwright coverage proves:

- the predicted DOM, score, and move count are already painted when the move
  fetch is invoked;
- the authoritative acknowledgement produces the same board without a second
  application;
- an active 503 rolls back both the active prediction and queued prediction,
  and the queued request is never sent; and
- a ranked move leaves the original board rendered until the server responds.

The existing Phase 1 suites also continue to prove FIFO transport, one active
request, no-op draining, eight-command saturation, terminal/error clearing,
new-game isolation, delayed responses, and classified drops.

## Validation

- Focused prediction/model/telemetry unit suites: 3 suites, 21 tests passed
  before the final full-suite run.
- Focused Phase 1 and Phase 2 browser regression set: 9 tests passed.
- Full unit suite: 163 suites, 568 tests passed.
- Full UI suite: 61 tests passed, with the expected diagnostics-only skip.
- TypeScript check: passed.
- Optimized production compilation: passed. The local post-build smoke reached
  the expected environment boundary because the auth-bridge secret is absent;
  `/api/auth/bridge-token` returned 503 instead of the configured production
  unauthenticated 401.
- Runtime commit `2690706` deployed successfully in Amplify job 391, whose
  recorded commit was `26907061a885147d9fd54fffecf73c0479353fa8`.
- Production smoke against `https://www.binary2048.com`: passed after job 391.
