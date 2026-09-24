# Binary-2048 Responsiveness Analysis

Date: 2026-09-17
Status: analysis only; no application changes made

## Executive conclusion

The main responsiveness difference is not React versus vanilla JavaScript, the
number of features in the repository, or the presence of authentication by
itself. Binary-2048 currently makes a successful server round trip a hard
prerequisite for changing the visible board. The comparison game changes its
game state locally and paints immediately.

The supplied Binary-2048 trace contains 83 complete move request/response
pairs. Their observed round-trip distribution is:

| Metric | Observed value |
| --- | ---: |
| Minimum | 112 ms |
| Median | 177 ms |
| Mean | 236 ms |
| p90 | 288 ms |
| p95, nearest-rank | 415 ms |
| Maximum | 2,731 ms |
| Moves at or above 250 ms | 18 of 83 |
| Moves at or above 400 ms | 5 of 83 |
| Moves at or above 500 ms | 4 of 83 |

These delays are directly exposed to the player because `setState(next)` and
the tile effects run only after the fetch and response parsing finish. A
177 ms median is perceptible; 400-700 ms feels hesitant; the 2.7-second sample
feels frozen.

There is a second mobile-specific problem: `onBoardTouchEnd` returns while the
page is `busy`, before calling the shared `move()` function. The move buffer is
inside `move()`. Consequently, keyboard inputs are buffered during an in-flight
request, but ordinary rapid swipes after React has rendered `busy=true` can be
dropped completely. Dropped swipes do not produce a `move_request` log entry,
so the supplied log cannot reveal them.

The highest-value direction is therefore:

1. make visual gameplay local/optimistic and independent of server latency;
2. send ordered server acknowledgements and recovery checkpoints in the
   background where authority is required;
3. make touch and keyboard use the same input queue;
4. remove diagnostic formatting and growing recovery snapshots from the
   every-move UI path;
5. isolate tournament/training computation from gameplay capacity when those
   routes are invoked.

## Scope and method

This review used:

- the comparison and pasted game log in
  [`performance_research.md`](./performance_research.md);
- the current Binary-2048 client, API routes, engine, recovery, authentication,
  rate-limit, session-store, tournament, and training code;
- a read-only inspection of [play2048.co](https://play2048.co/);
- the original 2048 project's
  [game manager](https://github.com/gabrielecirulli/2048/blob/master/js/game_manager.js),
  [input manager](https://github.com/gabrielecirulli/2048/blob/master/js/keyboard_input_manager.js),
  and [HTML actuator](https://github.com/gabrielecirulli/2048/blob/master/js/html_actuator.js);
- small headless-Chromium observations at a 390 x 844 viewport.

The browser observations are directional, not a substitute for a Pixel Chrome
performance trace. Internet conditions, CDN point of presence, cold starts,
advertising, and headless rendering differ from the user's phone.

The pasted log has a duplicated/truncated section around entries 644-646. Only
complete request/response pairs were included in the latency calculation.

## What the comparison actually shows

### Current play2048.co

The live site is no longer accurately described as a tiny vanilla page. The
inspected page used Svelte-generated markup, a canvas game surface, a tutorial,
power-up controls, and extensive third-party advertising traffic. In one
three-second observation it loaded far more resources and transferred more
data than Binary-2048.

That overall page weight does not prevent responsive moves because the move
itself stays local. In one headless mobile run, six arrow moves changed the
canvas after 21-34 ms and generated no first-party play2048.co gameplay
request. Advertising requests continued independently.

The classic open-source implementation follows the same latency-friendly
model: input emits a move, `GameManager.move` mutates the local grid, and the
actuator schedules local rendering. There is no per-move server dependency in
that gameplay path.

### Binary-2048

Binary-2048's page calls `move(dir)`, sets `busy`, awaits the authorization
header, loads and serializes the recovery snapshot, sends the move, parses the
response, saves a new snapshot, and only then replaces the visible state and
starts effects:

- [`app/page.tsx`](../app/page.tsx), `move()` around lines 437-570;
- [`app/api/games/[id]/move/route.ts`](../app/api/games/[id]/move/route.ts),
  move validation and response around lines 19-91;
- [`lib/binary2048/sessions.ts`](../lib/binary2048/sessions.ts), recovery and
  move handling around lines 67-107 and snapshot generation around lines
  147-165.

A direct production observation matched the supplied log: six moves took
107, 132, 140, 171, 191, and 446 ms from synthetic key input to a board DOM
change. The comparison site's local canvas changed in 21-34 ms in the same
style of observation.

The important distinction is therefore **network-gated visual state versus
local visual state**, not simply framework choice or total asset weight.

## Confirmed hot-path findings

### 1. Server acknowledgement gates every visible move

Impact: very high, all current players.

The page does not render a predicted move. Every normal move inherits network,
edge, cold-start, server scheduling, and response-parsing variance. This alone
is sufficient to explain the user's split-second delays.

The deterministic shared engine makes Binary-2048 unusually well suited to an
optimistic design. The client can calculate the same next board, RNG step,
spawn, score, and events immediately, then reconcile the server response.

### 2. Rapid touch input can be dropped before buffering

Impact: very high on mobile during quick successive swipes.

The touch-end handler checks `busy` and returns before calling `move()` in
[`app/page.tsx`](../app/page.tsx) around lines 951-960. The bounded queue lives
inside `move()` around lines 437-450. The rapid-input Playwright test in
[`tests/prod/rapid-input.browser.spec.ts`](../tests/prod/rapid-input.browser.spec.ts)
tests arrow keys, not touch events.

This produces two different input contracts:

- keyboard: an in-flight move can enqueue up to eight later moves;
- touch: a later swipe can be silently discarded while `busy` is visible to
  the event-handler closure.

This is likely part of the specific mobile symptom. It also explains why a
player can feel that a swipe was ignored while the diagnostic log looks
normal: no move function was called, so there is nothing to log.

### 3. The complete recovery move list travels both ways every turn

Impact: medium today, increasing with game length; more important on slower
phones and long games.

On every move the client parses the local recovery envelope and serializes it
into the request. The server maps the entire session step history into a new
snapshot, serializes and signs it, returns it, and the client synchronously
serializes it into `localStorage`:

- [`app/page.tsx`](../app/page.tsx), lines 459-478 and 526-533;
- [`lib/binary2048/resume-recovery.ts`](../lib/binary2048/resume-recovery.ts),
  lines 11-38;
- [`lib/binary2048/sessions.ts`](../lib/binary2048/sessions.ts), lines 147-165;
- [`lib/binary2048/recovery-signature.ts`](../lib/binary2048/recovery-signature.ts),
  lines 17-35.

The trace reaches 248 stored directions. This payload is still small enough
that it is unlikely to explain a 2.7-second response by itself, but its CPU,
storage, and transfer cost grows linearly and is paid every turn. Over a whole
game that creates quadratic cumulative bytes and serialization work.

### 4. The visible diagnostic log performs repeated whole-page state work

Impact: medium on long games; unlikely to be the main network-sized delay.

Each move normally adds at least `move_request`, `move_response`, and
`recovery_snapshot_saved`. Each call copies the diagnostics array into React
state. The home component then formats the full retained log, up to 250
entries, and controls a large read-only textarea. The log starts open:

- [`app/page.tsx`](../app/page.tsx), lines 153-154, 187-203, 463-495,
  526-533, and 1723-1752;
- [`lib/binary2048/diagnostics.ts`](../lib/binary2048/diagnostics.ts), lines
  30-41.

React may batch some post-response updates, but the design still adds avoidable
allocations, formatting, reconciliation, and textarea value updates to a
latency-sensitive screen. The log was valuable for finding the reset defect;
it should become an inexpensive support recorder rather than permanent visible
per-move UI work.

### 5. Binary-2048 redraws state after acknowledgement but does not animate
tile travel

Impact: medium for perceived fluidity after the latency problem is fixed.

The board maps 16 cells and applies merge/spawn/destruction effects. Sixteen DOM
cells are not inherently expensive, and a canvas rewrite is not justified by
the evidence. However, the current effects mostly scale/fade the destination
cell after the response; they do not show a tile translating from origin to
destination. That makes the pause more apparent than a local movement
animation would.

Some special-tile animations use `filter` and animated `box-shadow`, which can
increase paint cost on a phone. This needs frame data before changing it.

### 6. Initial HTML is dynamically gated by authentication lookup

Impact: medium for first load/refresh, not the cause of hesitation on every
move.

The root layout renders `AuthShell` for every route, and `AuthShell` awaits
`getServerSession` before the response:

- [`app/layout.tsx`](../app/layout.tsx), lines 39-70;
- [`app/auth-shell.tsx`](../app/auth-shell.tsx), lines 6-13.

Five no-cache HTML samples observed a median response-header time of about
216 ms for Binary-2048 versus about 100 ms for play2048.co. Binary's HTML body
was about 18.1 KB versus 5.3 KB. A separate browser run observed roughly
120 KB of transferred page resources for Binary versus roughly 679 KB for the
ad-heavy comparison page, so Binary is not generally heavier over the wire.

The better conclusion is that Binary's server-rendered/auth-aware startup is
slower while its overall resource transfer is smaller. Authentication should
hydrate without blocking the board shell where possible.

## What is not running on every move

Several features exist in the repository but are not automatically executed by
normal gameplay:

- export and replay-link generation run only when their controls are used;
- tournament orchestration runs only when `/api/bots/tournament` is requested;
- training generation runs only when `/api/training/replays` or
  `/api/training/labels` is requested;
- simulation runs only through its API routes;
- marketing tracking is not called for every ordinary move;
- guest authorization-header lookup returns locally without calling the bridge
  endpoint when the auth shell says the player is unauthenticated.

Accordingly, merely hiding these controls from guests will not remove the
177-415 ms normal move dependency. The heavy server routes can still affect
gameplay indirectly when invoked because they share deployment capacity, but
the supplied move log cannot prove that one of them caused a particular
outlier.

## Evaluation of the proposed tactics

### “Do less logging for guest games”

Recommendation: yes, but apply it to ordinary authenticated casual games too.

Use a ref-backed bounded ring buffer rather than React state. Record compact
numeric fields and materialize formatted text only when the player opens a
support panel or copies a report. Default the panel closed. In production,
retain errors, state regressions, network outliers, input drops, and perhaps a
small sampled tail of successful moves. A `?diagnostics=1` or explicit
`Enable Support Log` control can restore full tracing.

This is a worthwhile quick win, but it will not eliminate the network wait.

### “Move export to the authenticated-only view”

Recommendation: do not make authentication the performance boundary.

Export code is not invoked during a move. Removing its guest button saves only
a small amount of initial render/markup and would take away useful guest
recovery, bug-reporting, and replay sharing. Authentication also does not make
an expensive feature cheap.

A better design is to put Import, Export, replay sharing, diagnostics, and
advanced help in a lazy-loaded `Tools`/`Support` panel for all eligible users.
Load and render those components only when opened. Authorization should be used
for privacy, ownership, cloud history, or ranked-integrity requirements—not as
a substitute for code splitting.

### “Run tournament and training functionality only in certain scenarios”

Recommendation: strongly yes.

The home page does not call these routes, so they do not add direct per-move
client work. The risk is server contention when somebody does call them:

- tournament execution is synchronous inside the HTTP handler after acquiring
  an in-process slot;
- training replay/label generation is synchronous inside its HTTP handler;
- tournament and training have separate queues, but both queues are
  process-local and use the same web-runtime class as gameplay;
- the tournament limits permit large seed/bot/move combinations;
- rollout training can perform substantial nested simulation;
- `/api/sim/run` has a body cap but lacks the same rate-limit, challenge,
  degrade-mode, and explicit move-cost controls as `/api/simulate`.

These routes should be available only for explicit research/admin/API-key
workflows. Public requests should submit bounded jobs and receive job IDs.
Actual CPU work should run in a separately scaled worker deployment with its
own concurrency and cost budget. Pre-generated training pages belong in S3,
Mongo artifacts, or the private Hugging Face dataset rather than being rebuilt
inside a latency-sensitive web request.

Simply requiring a normal signed-in account is insufficient. Use an explicit
research/admin role or scoped API key, plus hard cost caps and separate compute.

## Recommended architecture by game class

### Guest casual games

Recommended target: local-first and offline-capable.

- Create and apply deterministic moves locally.
- Paint immediately without waiting for `/move`.
- Keep the compact seed/config/initial-grid/direction history locally.
- Checkpoint asynchronously every fixed number of moves, during idle time, on
  `visibilitychange`/`pagehide`, and at game end if server recovery is desired.
- Upload only for an explicit share/export/report action or final unranked run
  record.
- Mark all guest results untrusted and ineligible for ranked submission unless
  the server deterministically replays and validates the complete run.

This removes the network from the most common play path and gives guests the
closest feel to the comparison game.

### Authenticated casual games

Recommended target: the same immediate local-first experience with optional
cloud continuity.

- Apply and paint locally.
- Stream compact ordered deltas or periodic cloud checkpoints asynchronously.
- Use acknowledgement/version numbers to support multi-device conflict rules.
- Do not make bridge-token refresh block the visible move; refresh before user
  intent or let the sync queue wait while local play continues.
- Flush a final checkpoint on game end and best-effort on page hide.

Signing in should add durable history and multi-device benefits, not input lag.

### Ranked and competitive games

Recommended target: optimistic visual state plus server authority.

- Calculate the deterministic predicted move locally and render it immediately.
- Send directions in strict order with expected turn/state hash.
- Let the server remain authoritative for RNG, score, entitlement, integrity,
  and final submission.
- Reconcile acknowledgements in the background. On mismatch, pause input,
  restore the authoritative state, and visibly explain the correction.
- Keep the bounded input queue independent of network acknowledgements and
  animation timing, while never reordering or coalescing distinct ranked
  directions.

If product policy rejects any speculative ranked visuals, ranked mode can keep
server-gated state, but casual modes should not inherit that compromise.

## Prioritized improvement plan

### P0: measure the real input-to-paint path

Add performance marks for:

- touch/key captured;
- input accepted, queued, or dropped;
- local engine start/end;
- request queued and sent;
- response headers, body parse, and server acknowledgement;
- React commit and the next animation frame;
- recovery parse/stringify/write duration and payload bytes;
- event-loop long tasks and dropped frames.

Add `Server-Timing` breakdowns for rate-limit identity, recovery verification,
engine move, snapshot construction/signing, persistence scheduling, and total
route time. Current timestamps measure fetch round trip but cannot separate
network, cold start, server CPU, or post-response render.

### P0: unify touch and keyboard input behavior

- Route every valid swipe into the same bounded command queue as keyboard
  input; do not return solely because a request is in flight.
- Record queue depth and explicit drop reason.
- Clear touch origin on end/cancel and ignore unsupported multi-touch gestures.
- Add rapid-swipe Playwright coverage, not only rapid-arrow coverage.
- Until optimistic moves ship, show immediate input acknowledgement so a queued
  gesture does not look lost.

This is the smallest change most directly tied to the reported rapid-swipe
problem.

### P0: decouple visible moves from network acknowledgement

Use the existing deterministic `applyMove` engine on the client. Apply a move
to the latest predicted state immediately and animate it. Maintain a separate
ordered acknowledgement queue for modes that need the server.

This is the change most likely to transform the feel of the game.

### P1: replace per-move full snapshots with acknowledgements/checkpoints

Normal move request:

```text
session id + direction + expected turn/hash
```

Normal response:

```text
acknowledged turn + authoritative hash + score delta + spawn/events
```

Full signed recovery snapshot:

- periodic checkpoint;
- page hide/background transition;
- game over/win;
- reconnect or 404 recovery;
- explicit export/share.

Use a durable last-acknowledged checkpoint plus pending direction tail so a
crash loses little or no progress without rewriting the whole history each
turn.

### P1: make diagnostics cheap and opt-in

- Ref-backed ring buffer rather than per-entry React state.
- Closed by default in production.
- Format only on open/copy.
- Full success tracing only in support mode.
- Always retain errors, state regression, slow acknowledgements, and dropped
  input counts.
- Keep credential redaction.

### P1: isolate heavy workloads

- Disable public synchronous tournament/training generation by default.
- Require scoped research/admin API keys.
- Return asynchronous job IDs.
- Run jobs in a separate worker service/queue and CPU pool.
- Pre-generate training data and serve stored artifacts.
- Apply `/api/simulate`-equivalent protections to `/api/sim/run`.
- Preserve emergency degrade flags, but do not treat them as hard isolation.

### P2: improve rendering after input latency is fixed

- Extract and memoize the board/status path so diagnostic, options, share, and
  help state does not rerender it unnecessarily.
- Lazy-load replay import/player, advanced options, export/share, and support
  diagnostics.
- Consider FLIP/transform-based tile travel with stable visual tile identities.
- Profile special-tile filter/box-shadow effects on the Pixel before simplifying
  them.
- Do not move to canvas solely for speed; preserve accessible grid semantics
  unless measurement proves 16 DOM cells are a bottleneck.

### P2: stop auth lookup from blocking the guest game shell

- Serve/cache the game shell independently from session lookup where possible.
- Hydrate authentication status asynchronously.
- Keep auth-required controls fail-closed until identity resolves.
- Prefetch/refresh bridge credentials outside the input-to-paint path.

## Session persistence considerations

The current Mongo session store, when enabled, writes the complete `GameSession`
document after every `set`. A session contains the growing step list, and each
step contains before/after states and events. Persistence is fire-and-forget, so
it does not normally await the move response, but it creates growing queued
writes and shared CPU/network/database pressure.

It also starts Mongo hydration asynchronously on a cache miss and immediately
returns `null`. That can make a legitimate cold-instance request fall into the
404/recovery path before Mongo finishes loading.

Before enabling Mongo sessions for normal traffic:

- make reads truly awaitable with a bounded timeout;
- persist compact checkpoints and append/coalesce deltas;
- move write-behind work to a controlled queue;
- flush deliberately at lifecycle boundaries;
- measure queue depth, document bytes, hydration time, and write failures.

These are conditional concerns while production casual sessions remain on the
memory/local recovery path; they should not be blamed for the supplied trace
without confirming the deployed session-store mode.

## Performance acceptance targets

Validate on the user's Pixel in Chrome, using both deliberate and rapid swipes:

| Measure | Proposed target |
| --- | ---: |
| Input to first visible board change, median | under 50 ms |
| Input to first visible board change, p95 | under 100 ms |
| Client engine + state preparation | under 8 ms p95 |
| Long tasks during active play | none over 50 ms caused by game code |
| Valid rapid swipes silently dropped | 0 |
| Move request/response payload growth | effectively constant per normal move |
| Warm server acknowledgement p95 | under 200 ms |
| Acknowledgement outlier effect on local animation | none |
| Recovery after background/resume | no rollback and no duplicate move |

Test guest casual, authenticated casual, and ranked separately. Include normal
and Bitstorm boards, special-tile effects, a 250+ move game, background/resume,
network throttling, temporary offline mode, and simultaneous tournament/training
load in a non-production environment.

## Suggested order of experiments

1. Instrument input-to-paint, server timing, payload bytes, and drop reasons.
2. Add rapid-touch coverage and route touch through the existing queue.
3. Move diagnostics to a closed/ref-backed support recorder and remeasure.
4. Prototype optimistic local rendering while keeping the existing server API
   as the authority; compare feel and divergence rates.
5. Prototype guest local-first play with checkpoint-at-lifecycle boundaries.
6. Replace every-move full snapshots with constant-size acknowledgement plus
   periodic checkpointing.
7. Gate and move tournament/training work to isolated job workers, then run
   controlled contention tests.
8. Only after these changes, decide whether board rendering/animation itself
   needs a larger rewrite.

## Bottom line

Binary-2048 does not need to remove its deterministic engine, recovery,
integrity, accessibility, bot APIs, or research features to feel immediate. It
needs to keep those responsibilities out of the input-to-first-paint critical
path.

The first concrete defect to address is dropped rapid touch input. The largest
architectural win is local/optimistic deterministic rendering. Guest logging
should become cheap and opt-in, but export does not need to become auth-only for
performance. Tournament and training should be explicitly gated and isolated,
because they are a shared-capacity risk when invoked—not because they execute
on every normal move.
