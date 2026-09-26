# Binary 2048 v2 Plan

Status: initial planning document  
Created: 2026-09-17  
Implementation status: Phase 0 started; first client move-timing slice implemented

## Purpose

Binary 2048 v2 should preserve the deterministic engine, recovery, ranked
integrity, accessibility, bot APIs, and research workflows while making human
play feel immediate. The central design rule is that optional services and
network acknowledgement must not block input-to-first-paint.

This plan consolidates the overlapping findings and recommendations from:

- [`performance-analysis-2026-09-17.md`](./performance-analysis-2026-09-17.md)
- [`performance-improvement-report-2026-09-17.md`](./performance-improvement-report-2026-09-17.md)

Claims on which the reports disagree, or which are plausible but not proven by
the available trace, are listed under **Discrepancies and proof required**.

## Product goals

1. A valid swipe or keypress produces visible feedback within one frame where
   practical, independent of normal network latency.
2. Rapid inputs are handled consistently across touch, keyboard, and controls;
   accepted inputs are ordered and never silently lost.
3. Guest and authenticated casual games remain playable during temporary
   network loss and resume without rollback or duplicate moves.
4. Ranked games remain server-authoritative without making normal interaction
   feel server-paced.
5. Diagnostics, recovery, export, authentication, simulation, tournaments, and
   training stay outside the input-to-paint critical path.
6. Performance decisions are based on measured Pixel Chrome, desktop browser,
   server, and deployment behavior rather than assumptions.
7. Players and researchers can visually build deterministic board scenarios,
   save drafts, export them, and reuse them in simulations and tournaments.
8. Tutorial reminder preferences follow authenticated players across devices
   without removing the always-available Tutorial entry points.

### Tutorial preference synchronization

V1 keeps the guest `offer tutorial before new games` preference in a
non-sensitive first-party cookie. In v2, authenticated users should store a
versioned equivalent in their Mongo user settings. Authentication should
reconcile the guest cookie with the server preference without overwriting a
newer server value, and sign-out should fall back to the guest cookie. This
preference must remain outside ranked records, game sessions, and training
data; a storage outage must not block starting a game or tutorial.

## Shared findings from both reports

### 1. The visible board is gated by a server round trip

Both reports identify this as the dominant human-noticeable cost. The client
awaits the move request before replacing visible state. In the supplied trace,
83 complete request/response pairs had a 177 ms median, 415 ms p95, and a
2,731 ms maximum. Even the ordinary latency floor is perceptible when several
moves are made quickly.

**v2 direction:** run the deterministic engine locally, paint the predicted
result immediately, and reconcile with ordered server acknowledgements where
server authority is required.

### 2. The existing queue serializes progress behind acknowledgements

Inputs that reach the queue are drained only after the preceding request has
finished. A sequence of rapid moves therefore exposes multiple consecutive
network waits.

**v2 direction:** separate the local prediction queue from the network
acknowledgement queue. Preserve move order and never issue competing mutations
against the same authoritative turn.

### 3. Recovery work grows with game length

The client carries a growing direction history, the server produces signed
recovery data, and the client writes recovery state to local storage. On a
missing in-memory session, recovery may replay the historical move list. This
is not proven to be the source of the 2.7-second outlier, but it is structurally
more expensive as games grow.

**v2 direction:** use constant-size normal acknowledgements plus periodic full
checkpoints and a pending direction tail. Time and count all recovery paths
before changing their storage model.

### 4. Export is not a normal-move bottleneck

Both reports agree that replay export and its expensive signing work happen on
demand rather than on every move. Making export authenticated-only would not
materially improve move responsiveness.

**v2 direction:** retain export according to product, privacy, and integrity
requirements. Lazy-load Export, Import, replay sharing, and support tooling so
their UI and code do not burden the initial game shell.

### 5. Tournament and training code is not directly called by normal moves

The code paths are separate, so removing their controls from the game page
would not shorten an ordinary move. They may still compete for CPU or runtime
capacity if the deployment executes their synchronous workloads alongside
gameplay.

**v2 direction:** require scoped research/admin authorization, submit bounded
asynchronous jobs, and execute them in separately monitored CPU/concurrency
pools. Verify the actual hosting isolation before claiming this is a current
production bottleneck.

### 6. Small rendering optimizations are secondary

Rendering sixteen DOM cells, memoizing individual tiles, or changing to canvas
is unlikely to explain a 177 ms median delay. Animation and paint improvements
may improve perceived quality after network gating is removed.

**v2 direction:** retain accessible DOM semantics initially. Profile on the
target phone before changing special-tile effects or adopting a different
renderer.

## Proposed v2 runtime model

### Shared client pipeline

1. Capture a touch, key, or control input.
2. Validate it against the current predicted state.
3. Record whether it was accepted, queued, rejected, or dropped and why.
4. Apply the deterministic move locally.
5. Paint the predicted state immediately.
6. Append the direction and predicted state hash to an ordered pending queue.
7. Synchronize according to the game class below.
8. Reconcile acknowledgements in order; never silently replace newer local
   state with an older response.

### Guest casual

- Local-first and usable during temporary network loss.
- Store seed, configuration, initial grid, last checkpoint, and pending
  direction tail locally.
- Checkpoint asynchronously at bounded intervals, on page lifecycle events,
  game end, and explicit share/export/report actions.
- Treat scores as untrusted unless the server replays and validates the run.
- Keep a small support recorder locally without rendering or formatting it on
  every move.

### Authenticated casual

- Use the same immediate local-first pipeline as guest play.
- Add asynchronous cloud checkpoints and explicit multi-device conflict rules.
- Refresh bridge credentials before gameplay needs them; token refresh may
  delay synchronization but must not delay local painting.
- Flush best-effort on page hide and deliberately at game end.

### Ranked and competitive

- Render a deterministic prediction immediately.
- Send direction, expected turn, and expected state hash in strict order.
- Let the server remain authoritative for RNG, score, integrity, eligibility,
  and final submission.
- On divergence, stop accepting new inputs, restore the authoritative state,
  preserve diagnostic evidence, and explain the correction to the player.
- If optimistic ranked rendering is rejected as policy, keep server-gated
  behavior only in ranked mode rather than imposing it on casual play.

## Experimental mechanic spikes

These are decision gates and prototypes, not approved production rule changes.
Each spike must preserve deterministic replay/versioning and record its decision
before implementation is promoted into a shipped ruleset.

### Anchored Lock-0 behavior

- [ ] Prototype line resolution where a spawned Lock-0 remains at its board
  coordinate instead of sliding. For the active swipe, it partitions its row or
  column like a board edge while tiles in each resulting segment continue to
  slide and merge normally.
- [ ] Define and prototype the Lock-0 lifecycle/despawn trigger. A tile moving
  toward an active lock must stop in the adjacent cell; when the lock despawns,
  that tile may enter or pass the vacated cell only on a later swipe.
- [ ] Cover all four directions, tiles on both sides, multiple locks, adjacent
  merges, no-op/turn/spawn semantics, undo, win/game-over detection,
  replay/export/import, recovery, simulation/action masks, and deterministic
  RNG.
- [ ] Decide whether anchored locks replace the V1 rule globally or ship in a
  versioned V2 ruleset, including replay migration and event semantics.

The spike must explicitly decide whether despawn remains tied to global turn
parity or becomes per-lock lifetime/collision state, whether zero or wildcard
tiles can trigger despawn, and how several locks age independently.

### Death by Luck wildcard mode

- [ ] Prototype an explicitly serialized, unranked `Death by Luck` game mode
  with an overabundance of wildcard spawns, rather than inferring its identity
  from `pWildcard`.
- [ ] In this mode, prototype non-combinable wildcard-to-wildcard collisions
  while preserving wildcard-plus-number multiplication as the high-upside path
  to a fast win.
- [ ] Define interactions with zero, Lock-0, equal and unequal wildcard
  multipliers, scoring, win/game-over, undo, replay/import/export,
  simulation/action masks, and leaderboard eligibility.
- [ ] Run fixed-seed and Monte Carlo balance experiments across candidate
  wildcard rates and multiplier distributions. Report win rate,
  loss-by-board-fill rate, moves to win/loss, score/max-tile distribution, and
  sensitivity to luck before choosing defaults.
- [ ] Produce deterministic engine/schema regressions and browser/tutorial/help
  acceptance criteria with the spike decision; do not ship the mode until that
  decision is recorded.

Exit criterion: checked-in decision records choose precise semantics,
configuration, versioning, and balance targets with deterministic prototype
evidence. Current production behavior remains unchanged until separately
approved.

## Delivery plan

### Phase 0: establish a trustworthy baseline

- [x] Add performance marks for input capture, acceptance/queueing, local
  engine duration/status, request start, response headers, response parsing,
  React commit, and next animation frame. The current server-gated gameplay
  path truthfully records `localEngineStatus: not_run`; a duration will be
  measured when Phase 2 introduces client engine execution.
- [x] Record queue depth at capture, enqueue, dequeue, and drop, and retain a
  bounded classified record for every valid directional input that gameplay or
  UI state rejects. Non-direction keys and sub-threshold gestures are not move
  inputs; accepted request failures remain execution errors rather than input
  drops.
- [ ] Record request and response byte counts, recovery-history length,
  local-storage duration, and checkpoint duration.
- [ ] Add `Server-Timing` for rate-limit identity, session lookup, recovery
  verification/import/replay, engine move, snapshot construction/signing,
  persistence scheduling, and total route time.
- [ ] Record whether a move used resident memory, Mongo hydration, recovery
  import, or another fallback.
- [ ] Capture cold-start, event-loop delay, memory, and workload correlation
  where the hosting environment permits it.
- [ ] Repeat measurements on the user's Pixel in Chrome, desktop Chrome, and
  an authenticated session, not only in headless Chromium.

Exit criterion: a trace can explain where input-to-paint and server time were
spent and can distinguish an ignored gesture from a queued gesture.

### Phase 1: make input handling correct

- [ ] Route touch, keyboard, and onscreen controls through one command queue.
- [ ] Define the queue limit and visible behavior when it is full.
- [ ] Clear touch state correctly on end and cancel and handle unsupported
  multi-touch explicitly.
- [ ] Add real rapid-swipe tests in addition to rapid-arrow tests.
- [ ] Add tests for ordering, queue saturation, no-op moves, game-over
  boundaries, new-game transitions, and delayed/out-of-order responses.

Exit criterion: every valid accepted input is applied exactly once and in
order; silent input loss is zero in automated and real-device tests.

### Phase 2: local prediction and reconciliation

- [ ] Define a browser-safe interface around the existing deterministic
  engine without duplicating game rules.
- [ ] Apply and paint valid casual moves locally before network I/O.
- [ ] Maintain separate predicted, acknowledged, and pending state.
- [ ] Add turn and state-hash reconciliation.
- [ ] Define rollback, retry, offline, and unrecoverable-divergence behavior.
- [ ] Extend the model to ranked play after casual divergence tests pass.

Exit criterion: normal network latency and isolated response outliers do not
delay local animation, and seeded client/server runs produce identical states.

### Phase 3: compact synchronization and recovery

- [ ] Replace full-history normal move traffic with turn/hash
  acknowledgements and periodic signed checkpoints.
- [ ] Persist a last-acknowledged checkpoint plus a bounded pending tail.
- [ ] Move local-storage writes outside the input-to-paint path and ensure a
  lifecycle flush cannot corrupt or regress state.
- [ ] Make shared-store hydration awaitable with a bounded timeout before
  returning `Game not found`.
- [ ] Measure and reduce full-state retention in `session.steps` while
  preserving undo, replay, export, and integrity requirements.
- [ ] Define schema/version migration and backwards-compatible recovery.

Exit criterion: ordinary move payload size is effectively constant and a
250-plus-move game resumes without rollback, duplication, or a full replay on
the common path.

### Phase 4: remove optional work from active play

- [ ] Store diagnostics in a bounded ref-backed ring buffer.
- [ ] Default the support log closed and format it only on open or copy.
- [ ] Always retain errors, state regressions, slow acknowledgements,
  divergence, recovery fallback, and input-drop counts.
- [ ] Lazy-load Import, Export, replay sharing, advanced help, and diagnostics.
- [ ] Allow an explicit support mode to enable detailed success tracing.
- [ ] Make the game shell render independently of blocking authentication
  lookup where security permits; hydrate auth controls asynchronously and
  fail closed.

Exit criterion: opening or closing optional tools does not alter move latency,
and a closed diagnostic panel performs no full-log formatting per move.

### Phase 5: isolate research and compute workloads

- [ ] Audit the existing OpenAPI endpoint and developer docs, then prototype
  Swagger UI or an equivalent interactive API explorer for V2. The published
  contract must cover every supported gameplay, replay, simulation, job, and
  research endpoint with authentication, authorization scopes, rate limits,
  request/response examples, error shapes, and schema/version compatibility.
  Generate from canonical schemas where practical and add automated coverage
  that fails when implemented routes and the published contract drift.
- [ ] Inventory every simulation, tournament, training, and model-inference
  entry point and its deployed authorization and rate limit.
- [ ] Apply scoped API keys or research/admin roles and hard request/job caps.
- [ ] Convert synchronous long-running endpoints into job submission and
  status/result APIs.
- [ ] Run jobs outside gameplay capacity with separate concurrency, CPU, and
  cost budgets.
- [ ] Store generated artifacts rather than rebuilding them in web requests.
- [ ] Load-test gameplay while controlled training/tournament jobs run.

Exit criterion: developers can discover and exercise authorized V2 APIs from
the published contract, contract drift is caught automatically, and research
saturation does not materially change gameplay input-to-paint or warm
acknowledgement p95.

### Phase 6: perceived-motion and startup polish

- [ ] Profile special-tile filters, shadows, and effects on the target Pixel.
- [ ] Add transform-based tile travel with stable identities if user testing
  shows it improves comprehension and feel.
- [ ] Memoize or split the board only if React profiling shows material work.
- [ ] Measure guest shell startup before and after asynchronous auth hydration.
- [ ] Validate accessibility, reduced motion, safe areas, background/resume,
  and screen-reader behavior after animation changes.

Exit criterion: improvements meet the targets below without reducing
accessibility or correctness.

### Phase 7: visual scenario builder

- [ ] Add a dedicated scenario-builder view with an empty or existing board,
  board-size controls, seed, win tile, spawn configuration, game mode, and
  zero behavior.
- [ ] Provide a tile palette containing empty/erase, number tiles, zero,
  supported wildcard multipliers, and Lock-0.
- [ ] Let the user choose a palette tile and then place it in any board cell;
  also support replacing, clearing, dragging/painting where appropriate, undo,
  redo, and reset.
- [ ] Make placement fully usable with touch, mouse, keyboard, and screen
  readers. Announce the selected tile and each cell change.
- [ ] Add symmetry tools for horizontal mirror, vertical mirror, 180-degree
  rotation, and four-way symmetry so tournament boards can be constructed
  without manual transcription errors.
- [ ] Validate dimensions, tile values, wildcard multipliers, configuration,
  and whether the board has at least one legal move before play or export.
- [ ] Preview legal moves and resulting boards through the same deterministic
  engine used by gameplay and API simulation.
- [ ] Save named drafts locally and, for authenticated users, optionally save
  private server-side scenario records with version and ownership metadata.
- [ ] Export and import a versioned scenario JSON containing configuration,
  initial grid, seed, authoring metadata, and symmetry information without
  pretending it is a completed replay.
- [ ] Launch the scenario as an explicitly unranked practice game, or submit it
  to authorized tournament/training workflows through the existing simulation
  APIs.
- [ ] Support tournament scenario sets with stable IDs, names, tags, mirrored
  variants, deterministic seeds, and duplicate-board detection.
- [ ] Keep user-authored boards out of ranked leaderboards unless a future
  competition definition explicitly approves and signs the scenario.
- [ ] Add engine/schema unit tests and Playwright coverage for every tile type,
  placement and replacement, clearing, undo/redo, symmetry operations,
  validation, draft persistence, JSON round trips, mobile layout, keyboard
  operation, and tournament export.

Exit criterion: a user can construct a symmetric special-tile board without
editing JSON, save and reopen it, export and re-import an identical versioned
scenario, preview every legal move, and run the same deterministic board
through practice and authorized tournament tooling.

## Performance acceptance targets

| Measure | Initial v2 target |
| --- | ---: |
| Input to first visible change, median | under 50 ms |
| Input to first visible change, p95 | under 100 ms |
| Client engine and state preparation, p95 | under 8 ms |
| Game-code long tasks during active play | none over 50 ms |
| Valid accepted inputs silently lost | 0 |
| Duplicate or reordered moves | 0 |
| Normal move payload growth by game length | effectively constant |
| Warm server acknowledgement, p95 | under 200 ms |
| Network outlier effect on local animation | none |
| Resume result | no rollback or duplicate move |

These are initial targets, not facts. Phase 0 should confirm that they are
realistic on the target devices and hosting environment.

## Discrepancies and proof required

### Are rapid touch inputs dropped or queued?

One report found that the board touch-end handler returns while `busy`, before
calling the function containing the queue; the other described rapid input as
queued and not dropped. Both may be true for different input methods or render
timings: keyboard input can reach the queue while touch input may be rejected
by an earlier guard.

**Prove before fixing:** instrument input source, capture time, handler branch,
busy/in-flight values, queue depth, and outcome. Add synthetic touch gestures
while a delayed request is in flight and repeat on Pixel Chrome.

### Is there per-move diagnostic logging?

One report states that the visible support log receives several React state
updates and reformats retained entries each move. The other states there is no
telemetry or logging on the move hot path. This appears to use two meanings of
“logging”: local UI diagnostics versus remote telemetry.

**Prove before fixing:** profile a production build with the panel open and
closed; count state commits, formatting calls, textarea updates, CPU time, and
network telemetry. Treat local diagnostics and remote observability as
separate systems.

### Does recovery-history cost explain the 2.7-second outlier?

Both reports identify growing history and replay behavior, but neither proves
causation. The common latency did not steadily increase with turn count, and a
single large sample could instead be a cold start, scheduling pause, network
event, garbage collection, shared workload, or cross-instance recovery.

**Prove before fixing:** add server timings and path labels, then correlate
outliers with recovery import/replay length, instance identity, cold start,
event-loop delay, memory/GC, persistence, and concurrent jobs.

### Is unbounded `session.steps` retention causing garbage-collection pauses?

The retained before/after states plausibly increase memory pressure, but the
trace contains no heap or GC evidence.

**Prove before fixing:** measure document/heap size per session, sessions per
instance, allocation rate, event-loop delay, and GC pauses during long and
concurrent games. Verify exactly which historical fields undo, export,
leaderboard, auditing, and tests require before trimming them.

### Do tournament and training jobs share gameplay compute?

The routes are isolated in the source import graph, but source separation does
not establish deployment isolation. Process-local queues also do not guarantee
separate CPU capacity.

**Prove before fixing:** inspect deployed Amplify/runtime topology and logs,
record instance/function identifiers, and run a controlled non-production
contention test. Isolation remains a v2 requirement even if current production
contention is not observed.

### Is authentication a meaningful startup bottleneck?

One report observed slower Binary 2048 HTML response headers and identified a
root-layout session lookup. That small sample cannot isolate auth from CDN,
cold start, geography, or other server rendering.

**Prove before fixing:** compare repeated cold and warm guest/authenticated
requests with server timing, then prototype a cached game shell with
asynchronous auth hydration. Confirm fail-closed behavior for protected UI.

### Are `localStorage`, React rendering, or special-tile effects noticeable?

Each is a credible main-thread cost, but no supplied trace assigns enough time
to it to justify a rewrite. Sixteen DOM cells alone are not evidence that
canvas or aggressive memoization is needed.

**Prove before fixing:** use production React profiling, browser performance
traces, long-task observation, and paint/composite data on Pixel Chrome with a
250-plus-move history and special-tile-heavy boards.

### Should export become authenticated-only?

The performance reports agree that this is not a performance fix. There may
still be product, privacy, abuse, or ownership reasons to restrict it, but
those were not evaluated here.

**Prove before changing policy:** define the threat/product requirement,
measure bundle and render impact, and confirm whether guest export remains
needed for recovery and support reports.

## Test matrix

Each phase should cover:

- guest casual, authenticated casual, ranked, Normal, and Bitstorm;
- touch, keyboard, onscreen controls, and rapid mixed input;
- every special tile, no-op moves, win, game over, undo, and new game;
- delayed, failed, duplicated, and out-of-order responses;
- offline/reconnect and background/resume;
- short games and deterministic 250-plus-move games;
- cold/warm runtime instances and cross-instance recovery;
- support log open/closed and reduced-motion on/off;
- concurrent research load in a non-production environment;
- Android Chrome and iPhone Safari real-device acceptance.

## Decisions intentionally deferred

- Exact checkpoint interval and pending-tail size.
- Whether ranked mode permits optimistic visuals.
- Whether Mongo, another shared store, or an append-only service owns live
  session synchronization.
- Whether export remains available to guests.
- Whether the board needs FLIP animation, further memoization, or canvas.
- Worker/runtime provider and associated fixed-egress or networking cost.
- Scenario JSON versioning details, server-side draft quotas, and whether
  public scenario sharing is permitted.

These decisions should follow Phase 0 evidence and small prototypes rather
than being locked in by this initial plan.

## First implementation milestone

The first milestone should include only measurement and input correctness:

1. add end-to-end input-to-paint and server-path instrumentation;
2. create delayed-response rapid-touch tests that reproduce or refute dropped
   swipes;
3. unify accepted inputs behind one source-aware queue;
4. measure on the target Pixel and establish a checked-in baseline report.

Do not begin the larger synchronization rewrite until this milestone makes the
current behavior and failure modes observable.
