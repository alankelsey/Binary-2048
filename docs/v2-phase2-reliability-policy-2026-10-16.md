# V2 Phase 2 casual reliability policy — 2026-10-16

Status: implemented and accepted for the Phase 2 casual prediction boundary.
Durable checkpoint plus pending-tail storage remains Phase 3 work.

## Failure and retry contract

Each move keeps its original command identity, direction, acknowledged-state
hash precondition, and FIFO position across retries. Network exceptions and HTTP
502, 503, or 504 receive one automatic retry after 250 ms. A second failure
exhausts the budget: the active prediction rolls back to the last acknowledged
state, every later prediction is classified as cleared, and the player sees the
server or transport error. Other 4xx responses are not retried.

The existing missing-session path remains separate: HTTP 404 may import the
signed local recovery snapshot once and send the move to that recovered session.
The transient budget applies independently to the original or recovered request,
but recovery itself is attempted only once.

The state-hash precondition prevents a repeated request from applying silently
twice. HTTP 409 is never replayed. The client instead reads the authoritative
session once:

- if it equals the predicted post-move turn and hash, reconciliation accepts it
  as the acknowledgement for the already-applied command and drains the tail;
- if it is a valid different state, reconciliation adopts it, clears the tail,
  and reports the turn or hash divergence; and
- if the authoritative read fails, the client restores its last acknowledged
  state and blocks more moves until reload or New Game.

An older response and an unsupported hash version also clear the tail and block
more moves until reload or New Game. A valid authoritative turn/hash mismatch
clears the tail and continues from that returned board. These stops prevent new
commands from crossing a state that the client cannot verify.

## Offline contract

For casual games, `navigator.onLine === false` pauses the active request before
network I/O. The already-painted active command and the existing maximum of
eight pending commands remain in memory. An accessible status says that the
game is offline. The browser's `online` event resumes the active command first,
then the existing serial dispatcher sends the pending tail in FIFO order. The
same command IDs and hash preconditions provide duplicate prevention.

The offline tail is intentionally memory-only. Reloading or closing the page
discards unacknowledged moves and retains the last signed recovery checkpoint.
Phase 3 owns durable last-acknowledged checkpoint plus pending-tail persistence,
including lifecycle flushing and corruption/regression protection. This split
avoids creating a second storage format before that design is implemented.

Ranked games never paint or retain an offline prediction. They remain
server-authoritative; an unavailable request may use the same single transient
retry and then fails closed with the authoritative board unchanged.

## Acceptance evidence

Unit coverage proves one transient retry, exhaustion after two total attempts,
offline waiting before request dispatch, reconnect state transitions, no 409
retry, and the existing one-time 404 recovery behavior.

Browser coverage proves:

- a 503 followed by success keeps the immediate prediction and acknowledges it;
- two 503 responses roll back the active and queued predictions;
- a simulated lost response followed by 409 resolves through one authoritative
  read as a duplicate acknowledgement without applying the move twice;
- browser offline mode retains two predicted commands without a request, shows
  accessible status, and sends them left then down after reconnect; and
- injected authoritative divergence still clears the tail, while ranked paint
  remains server-authoritative.

## Validation

- Focused reliability/prediction/performance unit set: 3 suites, 24 tests passed.
- Focused Phase 2 browser suite: 7 tests passed.
- Full unit suite: 164 suites, 586 tests passed.
- Full UI suite: 65 tests passed, with the expected diagnostics-only skip.
- TypeScript check: passed.
- Optimized production compilation: passed. The local post-build smoke reached
  the expected environment boundary because the auth-bridge secret is absent;
  `/api/auth/bridge-token` returned 503 instead of the configured production
  unauthenticated 401.
- Roadmap progress after this slice: 335/361 (93%). V2 progress: 21/84
  (25.0%).
- Runtime commit `2095ca2` deployed successfully in Amplify job 395, whose
  recorded commit was `2095ca26b85e3d624dfab6f78df9439199387c25`.
- Production smoke against `https://www.binary2048.com`: passed after job 395.
