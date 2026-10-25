# V2 Phase 5 Gameplay Under Worker Load

Date: 2026-10-25

Status: complete

## Objective

Close the final Phase 5 item with a paired measurement of gameplay before and
while bounded tournament and training jobs occupy their separately capped
worker pools. The comparison must measure the browser's input-to-local-paint
trace and warm move acknowledgement p95, prove that the worker and gameplay
windows overlap, and preserve all deployed authorization, ownership, quota,
compatibility, and hard-cap boundaries.

## Predeclared protocol and gates

The test will use the existing production browser instrumentation and a new
operator-only orchestration script. It will capture a baseline first, enqueue
at most two tournament and two training jobs, wait until both worker classes
are observed running, and repeat the same gameplay measurement while they run.
The worker payloads may reach but never exceed the public route's aggregate
compute caps. The script must remove its job and artifact records afterward,
must not print credentials or artifacts, and must refuse a production target
without an explicit opt-in.

The acceptance gates are:

- both worker classes are observed running during the loaded gameplay window;
- all controlled jobs finish in at most two attempts and within the existing
  worker timeout/lease boundary;
- deliberate browser inputs have no drops or failed move responses;
- loaded input-to-local-prediction-paint p95 remains at or below the 100 ms target
  and changes by no more than 20 ms or 20%, whichever allowance is larger;
- loaded warm acknowledgement p95 remains below 200 ms and changes by no more
  than 20 ms or 20%, whichever allowance is larger; and
- the bounded HTTP gameplay sample has no errors and remains below the existing
  400 ms gameplay p95 ceiling.

The local-prediction-paint mark is the first browser callback after the
optimistic React commit. It is not a claim that desktop Chromium proves
physical display presentation on the target Pixel.

## Environment decision

The Amplify app currently exposes only the `main` production branch; there is
no deployed staging or development branch on which to run a shared-database,
deployed-worker contention experiment. Local validation will therefore prove
the harness and refusal gates first. The eventual deployed observation must be
small, off-peak, explicitly enabled, and bounded to the limits above. It will
be described as a controlled production observation, not as evidence that
source-code separation alone proves runtime isolation.

## Current continuation state

The bounded paired production observation and the complete stable-candidate
matrix passed, so the final Phase 5 plan item is checked. The next action is to
commit and push this candidate, verify its exact Amplify job and production
smoke, then update this record with the release identifiers and advance to the
first Phase 6 item. This section is maintained as gates change so a later
`continue` resumes from repository state without a generated prompt.

## Production result

The summarized result is committed at
`docs/load-results/gameplay-worker-isolation-latest.json`.

| Metric | Baseline p95 | Loaded p95 | Change | Gate |
| --- | ---: | ---: | ---: | --- |
| Input to local prediction paint | 109.30 ms | 82.20 ms | -27.10 ms | Pass: loaded under 100 ms and no regression |
| Warm server acknowledgement | 50.86 ms | 46.20 ms | -4.66 ms | Pass: loaded under 200 ms and no regression |
| HTTP gameplay move | 262.74 ms | 291.07 ms | +28.33 ms | Pass: under 400 ms and below the 52.55 ms allowance |

Each stage issued 40 HTTP gameplay moves alongside the paced browser sample.
All 80 HTTP moves succeeded. Each deliberate browser stage classified 20 of 20
inputs with zero queued or dropped inputs. Two tournament jobs at 25,000
decisions each and two rollout-label jobs at 500 labels each occupied the two
separately capped worker pools. Tournament and training were both observed
running when the loaded stage began, and all four jobs completed with one
attempt. The script's `finally` path removed its known job and artifact ids.

The 109.30 ms baseline local-paint p95 was above the absolute target because of
desktop-browser scheduling outliers, but the loaded stage itself was below the
target and materially faster. The gate was not relaxed after observing the
baseline. This establishes no worker-induced regression; it does not replace
the Phase 6 target-Pixel profiling work.

## Harness corrections found during acceptance

The reused Phase 0 browser measurement had three assumptions that no longer
matched the V2 client. Phase 2 now reports completed local prediction, compact
sync only builds/signs recovery snapshots on checkpoint responses, and a trace
can finish just before the UI becomes idle. The harness now accepts the current
local-engine state, treats checkpoint timings as optional, waits for idle
between deliberate inputs, requires those inputs not to queue, performs a
fixed 12-move warmup, and reports local-prediction paint separately from final
acknowledgement paint. These are measurement corrections; no gameplay or API
contract changed, so the OpenAPI surface remains unchanged.

## Candidate validation

The stable candidate passed:

- focused workload-inventory and move-performance validation: two suites and
  13 tests;
- seven pure harness tests covering percentile math, bounded configuration,
  loopback refusal, task shapes, and all acceptance gates;
- the full unit suite: 176 suites and 682 tests;
- the full UI suite: 77 passed with two expected skips;
- TypeScript route generation and checking;
- the production worker bundle;
- optimized production compilation; and
- the packaged production-build smoke.

The first UI invocation was denied macOS Chromium Mach-port registration by
the sandbox. The host-level retry then correctly exposed the documented local
dev-server prerequisite; the full suite passed once that server was running.
The first optimized compile passed but its smoke lacked the disposable auth
value at build time. The compile passed again with the full disposable auth
environment; its in-sandbox smoke could not bind port 4110, and the already
built package passed the identical smoke outside the sandbox. These were
environment/precondition failures rather than product-test failures.

## Delivery-efficiency log

Repository discovery was kept in focused batches. One initial combined read
returned about 6,000 output tokens and exceeded the 5,000-token batch ceiling;
subsequent batches were capped below 5,000. The measured 35% comparison remains
open.

The first deployed attempt did not consume worker capacity because it failed
during baseline validation before the orchestration code opened the worker
environment or inserted a job.

The focused browser work required additional reruns to correct the three stale
measurement assumptions above. The final paired run then passed once without a
worker retry. Focused drift validation required one correction after its first
assertion looked for a derived numeric literal rather than the task-shape
inputs. The full unit suite ran once. V2 progress is 41/84 (48.8%);
whole-roadmap progress remains 347/374 (93%). The measured 35%
delivery-efficiency comparison remains open.
