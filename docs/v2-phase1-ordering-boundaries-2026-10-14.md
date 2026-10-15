# V2 Phase 1 ordering boundaries

Date: 2026-10-14

Status: the automated ordering, saturation, no-op, terminal/error, new-game,
and delayed-response boundary item is deployed and production-smoke accepted.
Physical rapid-swipe and touch-interruption acceptance remain open.

## Serial response invariant

Phase 1 intentionally allows only one move request in flight. Pending commands
stay in the browser FIFO until the active response is parsed, applied to state,
and releases the queue drain. Therefore multiple move responses cannot settle
out of order in this architecture: request N+1 does not exist on the network
while request N is unresolved.

The meaningful “out-of-order response” proof is consequently a prevention
invariant rather than a response-reordering simulation:

- delay the first response longer than the nominal delays assigned to later
  responses;
- verify only the first request has started during that delay;
- verify maximum concurrent move requests remains one;
- verify directions arrive at the server and complete in captured FIFO order;
  and
- verify each next request uses state produced by the prior response.

If Phase 2 introduces prediction, parallel synchronization, retries that can
overlap, or independent acknowledgements, it must add sequence/turn and state
hash reconciliation plus genuine reversed-settlement tests. Injecting a second
concurrent Phase 1 response would test behavior the current client forbids.

## No-op boundary

The delayed test returns a successful first response with `lastStep.moved=false`
and an unchanged turn, followed by two successful moved responses. The no-op
still completes its accepted trace through React commit and next frame. It does
not stall, duplicate, or clear the pending queue; the following directions run
once and in order. The final UI reports two moves after three completed input
traces, which distinguishes a completed no-op from lost input.

## Terminal and failure boundaries

The earlier command-queue proof covers both cases with pending mixed-source
commands. A first game-over response clears every pending trace as
`buffer_cleared_terminal_state`; a failed first response clears them as
`buffer_cleared_move_error`. Neither case sends a second move request.
Saturation separately proves one active plus eight pending, the tenth input's
single `queue_full` classification, and preserved FIFO direction/source order.

## New-game boundary

The new transition test opens the New Game setup over an active guest session.
A direction pressed in the modal creates one `modal_open` classification and no
move request. Escape returns to the unchanged session, where the next direction
uses the old game ID. After the guarded New Game confirmation creates a
replacement session, the next direction uses only the replacement game ID.
No modal input leaks into either session and no old-session command appears
after replacement.

## Local acceptance

- Both focused Phase 1 ordering-boundary Chromium tests passed.
- The production-equivalent local UI suite passed 57 tests with one expected
  diagnostics skip.
- The complete unit suite passed 161 suites and 555 tests. TypeScript validation
  passed.
- The production bundle compiled, type-checked, and generated all 62 static
  pages. The local wrapper then reached the known environment-only smoke blocker:
  `/api/auth/bridge-token` returned 503 because the production bridge secret is
  intentionally unavailable locally.
- Commit `e410f6076844ade3855ad85e2a6cae8ec48c1c93` deployed successfully
  through Amplify job 386. The post-deploy production verification passed.

These browser tests use mocked local routes so delays and states are controlled
without mutating production. They complement rather than replace the physical
Pixel protocol.
