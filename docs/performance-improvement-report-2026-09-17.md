# Performance & Responsiveness Report — 2026-09-17

Report only — **no code was changed** for this analysis. Scope: why Binary
2048 feels less responsive than `play2048.co` on quick successive swipes,
using `docs/performance_research.md` (the comparison writeup + a production
move-log excerpt) plus a direct read of the client input path, the move API
route, session/recovery logic, the engine, rate limiting, and the
bot/tournament/training code, as the basis. Four background research passes
(cheaper model, read-only) fed this report; every claim that materially
drives a recommendation below was re-verified directly against the current
code by this session before being included — citations point at the
verified location, not just the sub-agent's claim.

## TL;DR

The single biggest driver of "feels laggy vs. play2048.co" is architectural
and affects **every** player, guest or authenticated: **there is no local/
optimistic move prediction at all.** Every swipe waits for a full network
round trip before the board visually updates, and rapid swipes are queued
and sent **one at a time, fully serialized** — each buffered swipe waits for
the previous one's complete round trip before it's even sent. play2048.co
has no server and updates the grid synchronously in local JS; Binary 2048
is (by necessity, for anti-cheat and leaderboard integrity) server-
authoritative, so it always pays a round trip per move — the fix is to stop
making the UI *wait* on that round trip, not to remove the round trip.

The user's three specific hunches were checked directly against the code
and **none of them hold up as real levers** for this problem:

- **"Guest games not logging / fewer checks"** — there is no telemetry or
  logging on the move hot path today, for anyone. Guest and authenticated
  requests already run essentially the identical per-move pipeline.
- **"Move export to auth-only view"** — the expensive part (replay/HMAC
  signing) already only runs on-demand when Export/Submit is clicked, for
  both guest and authenticated sessions. Gating the *button* would remove a
  couple of unused DOM nodes, not any computation.
- **"Tournament/training only needs to run under certain scenarios"** —
  already true at the code level: bot/tournament/training/ML modules are
  not reachable from the move route's import graph at all.

The real, verified, actionable findings are further down: no optimistic UI
(biggest lever), unbounded full-state retention in server session memory
(a plausible GC-spike contributor), and a full-history replay path that
fires when a request lands on an instance that doesn't have the session
in memory.

---

## 1. What the log actually shows

`docs/performance_research.md` includes a ~250-line excerpt of production
`move_request`/`move_response`/`recovery_snapshot_saved` log lines for one
game (`g_perf_sample`, turns 161–~245). Reading the timestamps:

- The overwhelming majority of `move_request` → `move_response` round
  trips are **130–300ms**, consistent turn after turn, all the way to
  turn 245 (i.e., latency does **not** grow with game length in the
  common case — see §3.2 for why that matters).
- One clear outlier: turn 209 → 210, `move_request` at `23:21:47.783Z`,
  `move_response` at `23:21:50.514Z` — **2,731ms**, roughly 10–20× the
  baseline.
- One smaller outlier: turn 243 → 244, **415ms** — still noticeable but
  much less dramatic.
- Everything else in the excerpt is unremarkable server-side; the larger
  *gaps* between some request pairs (e.g. multi-second gaps at turns
  238→239, 239→240) are time between the player's own swipes (think time),
  not server latency — the request/response pair itself is still ~150–260ms
  in those cases.

So: out of ~85 moves in this excerpt, essentially all of them sit at a
consistent ~150–300ms floor, and there is exactly one dramatic (2.7s)
outlier and one moderate (415ms) one. That distribution matters for how to
read the user's complaint: **"quick swipes in succession, the app at times
takes a split second to respond" is not primarily describing the rare
multi-second spike** — it's describing the *normal* 150–300ms-per-move
floor becoming very noticeable specifically when swipes come in quickly,
because (per §2) each queued swipe pays that same floor again, serially,
with nothing shown on screen in between. The rare multi-second spike (§3)
is a real, separate problem worth fixing, but it's not what a player feels
on every fast flick sequence.

## 2. The real driver: no optimistic UI + serialized move queue

**Verified in `app/page.tsx`:**

- `move()` (`app/page.tsx:437-571`) calls `await requestResumableMove(...)`,
  which performs the `fetch` to `/api/games/:id/move` and awaits the JSON
  response, and only then does `setState(next)` happen
  (`app/page.tsx:553`, inside the `try` block, after the `await`). There is
  **no local application of the move** before the response arrives — the
  board shows nothing different until the server round trip completes.
  This is the architectural gap vs. play2048.co's fully local, no-network
  update.
- Rapid input is not dropped or debounced — it's queued. At the top of
  `move()` (`app/page.tsx:439-449`), if a move is already in flight
  (`moveInFlightRef.current`), the new direction is pushed onto
  `bufferedMovesRef` (cap `MAX_BUFFERED_MOVES = 8`, `app/page.tsx:102`) and
  the function returns immediately — nothing happens for that swipe yet.
- The queue is drained **one at a time**, and only after the in-flight
  move's full response has landed: `app/page.tsx:906-914`'s `useEffect`
  fires on `state`/`busy` changes, and only when `busy` is false and
  nothing is in flight does it `shift()` a single buffered direction and
  call `move()` again — which itself then awaits its own full round trip
  before the *next* buffered move can even be sent.

Net effect: for a 4-swipe rapid flick, the player sees the board update
4 times, each ~150–300ms after the *previous* one's response, i.e. the
whole sequence takes ~4× a single round trip to visually resolve, with the
board frozen (except for `busy` disabling input, not shown as movement)
between each one. That is exactly the "waits a split second" feel, and it
compounds with every additional quick swipe. This applies identically to
guest and authenticated sessions — nothing here is auth-gated.

**Not the driver — checked and ruled out:**

- Tile animation is CSS `@keyframes`/`animation` shorthand
  (`app/globals.css:505-519`, e.g. `mergeNumber 260ms`, `mergeWild 340ms`,
  `spawnPulse 210ms`), triggered by adding a class name after the state
  update — not JS-driven per-frame positioning. This is already the
  GPU-friendly approach the comparison doc recommended; it is not
  contributing meaningfully to perceived lag.
- The board's ~16 cells are not individually memoized
  (`app/page.tsx:1148-1183`), so every move re-creates all cell JSX nodes.
  This is real but very unlikely to be perceptible next to a 150ms+ network
  round trip — React reconciliation over 16 simple `div`s is sub-millisecond
  work. Not worth prioritizing ahead of §2/§3.
- No client-side HMAC/crypto and no blocking marketing/telemetry calls sit
  in the critical path — `trackMarketing(...)` calls are fire-and-forget
  and wrapped in `try`/`catch` that swallows errors.

**One real, independent, per-move client cost worth naming:** on every
move, the client synchronously reads the recovery snapshot from
`localStorage` *before* even sending the request
(`loadResumeSnapshot(...)`, `app/page.tsx:462`) and synchronously writes
the updated one back *after* the response
(`saveResumeSnapshot(...)`, `app/page.tsx:528`). For this game's snapshot
shape (`recoverySnapshot.moves` is just an array of one-letter directions,
not full board states — confirmed in `lib/binary2048/sessions.ts:147-166`)
this is cheap even at 250+ moves, but it is still synchronous main-thread
I/O sitting directly in the per-move critical path, for guest and
authenticated play alike, and `localStorage` is known to have occasional
unpredictable stalls on some browsers/devices. Minor compared to §2, but
free to defer/batch if §2 is tackled.

## 3. The rare multi-second spike

Two independently-verified mechanisms are real and could plausibly produce
an occasional, isolated multi-second spike like the one at turn 209–210.
Neither is proven to be *the* cause of that specific spike — that would
need production instrumentation — but both are genuine, currently-live
behaviors worth knowing about.

### 3.1 Unbounded full-state retention in server session memory

`moveSession()` (`lib/binary2048/sessions.ts:89-108`) pushes a full `step`
record onto `session.steps` on **every move**, and that record holds full
`before` and `after` `GameState` clones (`lib/binary2048/sessions.ts:95-102`,
via `applyMove`'s `cloneState` in `lib/binary2048/engine.ts:121-149`) — not
just the move direction. `session.steps` is never trimmed; it grows for the
entire lifetime of the session, in per-instance in-memory storage. For the
250-move game in the log, that's 500 full board-state clones retained in
memory for one session; across many concurrent long-running sessions on one
instance, this is unbounded growth that increases GC pressure over server
uptime. This would explain the *shape* of the log (mostly fast, occasional
isolated stalls) better than something game-specific, since a stop-the-world
GC pause affects whichever request happens to be in flight when it fires —
not necessarily correlated with that particular game's own move count.

Only the last `undoLimit` steps' `before` state and the move *direction*
list are actually needed downstream (undo, export, leaderboard
submission — `exportSession`/`buildExport` and `exportRecoverySnapshot`
already only serialize directions plus current/initial state, not the full
per-step history). Retaining full before/after state for every step
appears to be more than the feature set actually needs.

### 3.2 Cross-instance session-recovery replay

`resolveSessionWithRecovery()` (`lib/binary2048/sessions.ts:67-87`) is
called on **every** move request — the client attaches its locally-stored
recovery snapshot to every move (`app/page.tsx:461-462,477`), not just
after an error. In the common case (session already resident in this
instance's memory, snapshot length matches), it's cheap: signature verify
(`verifyRecoverySignature`, HMAC over a compact direction list — fast even
at 250 moves) plus a length comparison, then it just returns the existing
in-memory session (`lib/binary2048/sessions.ts:84-86`).

But if the request lands on an instance whose in-memory store doesn't have
this session — e.g. load-balancer routing to a different instance than the
one that handled the previous move, a known, already-documented issue for
this Amplify-hosted, per-instance-memory architecture (see the mobile UI
audit doc's reference to "Amplify routes a request to a different
instance") — `importRecoverySnapshot()` (`lib/binary2048/sessions.ts:229-237`)
runs instead, which calls `runScenario()`
(`lib/binary2048/engine.ts:151-167`): a synchronous **replay of every move
in the game from the initial grid**, one `applyMove` + multiple
`cloneState` calls per historical move, before the current move can even be
applied. For a 209-move-deep game, that's ~200+ replayed moves synchronously
inside a single request. Per-clone cost is small, so this alone may not
fully explain 2.7 seconds, but it's a real, verified, O(game-length) cost
that only shows up occasionally (exactly the log's pattern) and gets more
expensive the longer a game runs — which is consistent with the spike
occurring at turn 209 rather than turn 20.

**Recommended next step for both 3.1 and 3.2 is instrumentation, not a
guessed fix:** add timing around `importRecoverySnapshot`/`runScenario` and
around GC pause metrics (or just log `session.steps.length` at response
time) in production, confirm how often each path fires and how long it
takes, then decide whether to trim retained history (3.1), cap/avoid replay
depth or move to a shared session store (3.2), or both.

### 3.3 Open question this report can't answer from the repo alone

Bot tournament and ML-training-replay generation (`runBotTournament`,
`generateTrainingReplays`/`generateTrainingLabels`) are confirmed
CPU-heavy, queue-gated (max 8 concurrent tournament slots, max 2 training
slots — `lib/binary2048/tournament-queue.ts`, `lib/binary2048/training-queue.ts`)
work, isolated to their own `/api/bots/*` and `/api/training/*` routes with
no import-graph connection to the move route (`lib/binary2048/sessions.ts`'s
own import chain, and the move route's imports, were checked directly and
contain no tournament/training/ops-telemetry modules). **If** this Next.js
app runs as a single shared Node process/instance for all routes (rather
than per-route isolated compute), a concurrent tournament or training job
could still stall the shared event loop for real players' `/move` requests
even though the *code* is cleanly separated — that's a hosting/deployment
question this repo can't answer by itself. Worth checking whether a
tournament/training run in production correlates with move-latency spikes
before ruling this in or out.

## 4. Correcting/confirming `docs/performance_research.md`'s specific guesses

| Comparison doc's guess | Verdict |
|---|---|
| "Deterministic RNG + HMAC-signed replay logging — likely serializing move state every turn" | **Partly right, smaller than implied.** A compact recovery-snapshot signature (direction list only, not full state) *is* computed every move (`lib/binary2048/sessions.ts:164-165`) — cheap. The heavier replay/leaderboard HMAC signing (`lib/binary2048/replay-signature.ts`) is **not** per-move; it only runs on-demand for Export or leaderboard submission (`app/api/games/[id]/export/route.ts`, `app/api/leaderboard/submit/route.ts`). |
| "Anti-cheat checks — probably validating each move" | **Confirmed, but cheap.** Optional state-hash check (only if the client sends `expectStateHash`) plus the recovery-signature verify above — both in-memory, no I/O, sub-millisecond. Not the bottleneck. |
| "A REST bot API layer — if any move data round-trips to a backend, that's latency the original never pays" | **This is actually true of every player, not just bots** — Binary 2048 is server-authoritative by design (anti-cheat, leaderboard integrity), so *every* move round-trips, guest and authenticated alike. This is the single largest architectural difference from play2048.co, and it's intentional. The fix is §2 (stop the UI waiting on it), not removing the round trip. |
| "Auth/session state (guest/Sign in header) — extra context to check or re-render" | **Not substantiated.** `move()`'s state updates (`setState`, `setUndo`, etc.) are scoped to game state, not header/nav auth state; no evidence of per-move header re-render cost. |
| "Heavier options/accessibility surface — more re-render if not memoized" | **Real but minor.** Board cells aren't `React.memo`'d, but at ~16 cells this is not perceptible next to network latency. |
| "Move animation via JS state instead of CSS" | **Wrong for this codebase** — confirmed CSS `@keyframes`, not JS-driven positioning (§2). |
| "Synchronous work on the input handler before UI update" | **True, but not the synchronous work guessed** — it's not signing/anti-cheat blocking the UI, it's that *the entire move* is gated behind the network response by design (no optimistic path at all). |

## 5. Recommendations, prioritized by human-noticeable impact

None of these were implemented — this is a report only.

### App-wide (benefits guest and authenticated equally — do these first)

1. **Add local/optimistic move prediction.** The same deterministic
   `applyMove` logic already exists in `lib/binary2048/engine.ts`; apply it
   locally the instant a swipe/keypress happens, render immediately, then
   reconcile with the server's authoritative response when it arrives
   (the existing `stateHash` mechanism can detect divergence and snap-
   correct on the rare mismatch). This directly targets the exact
   complaint and is the standard architecture for "instant local, server
   as source of truth" turn-based games. Server remains authoritative for
   scoring/anti-cheat/leaderboard — nothing about server trust changes.
2. **Un-serialize the buffered-move queue** so it pairs with #1: once moves
   apply optimistically and instantly, letting queued swipes advance the
   *local* predicted board immediately (while at most one request is in
   flight to the server, reconciling the queue against the authoritative
   response stream as it lands) removes the "each swipe waits for the
   previous swipe's full round trip" serialization entirely.
3. **Investigate and likely trim `session.steps`'s unbounded full-state
   retention** (§3.1) — instrument first, then cap what's retained to what
   undo/export/leaderboard submission actually need (direction history +
   the last `undoLimit` steps' `before` state), not full before/after
   clones for the entire game.
4. **Instrument the cross-instance recovery-replay path** (§3.2) before
   optimizing it — confirm how often `importRecoverySnapshot`/`runScenario`
   fires in production and its actual cost, since it's a strong structural
   candidate for the log's outlier but unproven as *the* cause without
   real numbers.
5. Optionally defer/batch the client's per-move `localStorage` read/write
   (§2, last paragraph) off the critical path (e.g. `requestIdleCallback`)
   — minor, but free once #1/#2 land and touch this code anyway.

### Guest-specific

No guest-specific per-move cost was found that isn't also paid by
authenticated sessions — the pipelines are essentially identical today.
The user's instinct that guest sessions could skip logging/checks doesn't
match the code: there is no logging on the move hot path for anyone, and
the checks that do exist (rate limit, recovery-signature verify) are
already cheap and already guest-appropriate (guest traffic uses the
in-memory rate-limit counter, never Mongo — `lib/binary2048/rate-limit.ts:217-228`,
`sharedForApiKeysOnly: true` on `checkMoveRateLimit`; Mongo-backed rate
limiting is reserved for verified bot-API-key traffic, which normal
guest/authenticated browser play never uses). If a guest/auth split is
still wanted for other reasons (e.g. product/analytics), it would need to
be introduced net-new rather than "removed" — there's no existing
guest-only overhead to cut.

### Authenticated-specific

Nothing authenticated-only was found to be materially heavier per move
either. The only genuinely authenticated-only work (replay/leaderboard
HMAC signing, `lib/binary2048/replay-signature.ts`) already runs on-demand
at submission time, not per move, so it's already correctly out of the hot
path.

### Tournament/training

Already correctly isolated at the code level (§3.3) — not a per-move cost
today. The one open item is verifying process/compute isolation on the
hosting side, which is outside what this repo can confirm by itself.

---

## Methodology note

This report was produced with four parallel, read-only research passes
(client move-dispatch path; server move-route per-request work; bot/
tournament/training reachability; export/replay signing cost) run on a
cheaper model, whose findings were then independently spot-checked by
this session by reading the actual source referenced above before being
included here — `app/page.tsx`'s `move()`/buffer-drain effect,
`app/api/games/[id]/move/route.ts`, `lib/binary2048/sessions.ts`,
`lib/binary2048/engine.ts`'s `applyMove`/`runScenario`/`cloneState`, and
`lib/binary2048/rate-limit.ts`'s Mongo-vs-memory branch were all read
directly, not taken on the sub-agents' word alone. No files were modified.
