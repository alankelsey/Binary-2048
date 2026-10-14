# V2 Phase 0 runtime-correlation evidence

Date: 2026-10-13 America/Boise (production capture: 2026-10-14 UTC)

Status: deployed and accepted. Physical-device and authenticated-session
measurement remain open, so Phase 0 is not complete.

## Accuracy corrections

Commit `75b961d6da7abb4c2f7f5dc9c78e81603fff0e6d` corrected three findings from
the first timing deployment:

- session-store failures now use a typed storage-unavailable error and return
  HTTP 503; conflicts remain 409 and malformed recovery remains 400;
- a resolved missing session is passed explicitly to the move operation, so a
  404 performs one store lookup rather than a second uninstrumented lookup;
- recovery delete and final-write attempts record persistence time in
  `finally`, including failed operations. The trusted-recovery revision lookup
  is also included in aggregate session-lookup time.

Injected-store tests cover lookup failure with and without recovery, a
single-read 404, persistence conflict, persistence outage, malformed recovery,
failed recovery deletion, and failed recovery final write. Responses do not
expose injected storage details.

## Private runtime schema

The public `Server-Timing` contract is unchanged. Sampled protected
`binary2048_move_timing` events now include a fixed `runtime` object with:

- an ephemeral random runtime ID, `first_observed` or `reused`, a bounded move
  ordinal, and runtime age;
- cumulative process-local event-loop-delay mean, p95, and maximum plus the
  request-boundary event-loop utilization delta;
- rounded Node RSS, heap, external, and array-buffer MiB point samples;
- aggregate GC count, total duration, and maximum duration observed after the
  process-local observer attached; and
- in-flight and peak counts for this instrumented move route only.

The richer block is sampled for the first five observed moves, every twentieth
move, errors, missing/recovery paths, and process-local concurrent moves. It
adds no awaited work. Its serializer reconstructs a fixed schema, clamps
numbers, and rejects arbitrary fields. It contains no game, session, user,
account, IP, API-key, cookie, token, signature, request body, raw error,
hostname, PID, Mongo address, or AWS infrastructure identifier.

`first_observed` means the first move seen by this loaded application runtime.
It is a cold-start candidate, not authoritative proof of an Amplify container
or host cold start. Memory describes the Node process rather than its container
or limit. GC data covers only entries observed after attachment. Event-loop
histograms can include freeze/thaw and idle gaps. Workload counts cover only
move requests in the same process; they do not represent fleet load or SQS
worker activity.

## Verification and deployment

- Full unit suite: 161 suites, 551 tests passed before deployment.
- TypeScript and focused timing/session/runtime suites passed.
- Next.js compilation, type validation, static generation, and route manifest
  completed. The local wrapper then reached the previously documented missing
  auth-bridge-secret smoke condition.
- Amplify job `379` deployed the exact implementation commit successfully.
- The standard production smoke passed on its first attempt.
- The sanitized acceptance probe made six sequential moves, one miss, one
  unsigned compact recovery, and four moves in a bounded parallel batch. All
  12 responses retained valid `Server-Timing` and `Cache-Control: no-store`.

## Production observations

The acceptance window ran from `2026-10-14T00:35:09.056Z` through
`2026-10-14T00:35:14.160Z`. A narrow protected CloudWatch query showed three
application runtime IDs.

One reused runtime handled the sequential work at move ordinals 3 through 10.
Its normal route totals were mostly 33–36 ms, RSS was 139–142 MiB, heap used
was 59–60 MiB, and observed GC count increased from 7 to 14. Its cumulative
event-loop histogram reported large historical gaps (p95 up to 8.6 seconds and
maximum 8.8 seconds) even while these requests completed quickly. This confirms
that the cumulative histogram includes runtime scheduling or freeze/thaw
history and cannot be assigned to an individual request.

The four-request parallel batch was distributed across three runtimes. Two
requests on the reused runtime completed in 32.38 and 33.55 ms. Two other
runtimes recorded `first_observed`, ages of 331 and 361 ms, RSS of 128–129 MiB,
heap used of 53 MiB, and one observed GC event each. Their Mongo lookup stages
were 296.84 and 320.48 ms, producing route totals of 330.88 and 361.54 ms.
The first-observed proxy and slower lookup co-occurred; this sample does not
prove that an Amplify cold start or Mongo connection setup caused the delay.

No runtime observed more than one in-flight move. The bounded batch therefore
demonstrated distribution across runtimes rather than same-process contention.
Increasing production load merely to force co-location was not justified.

## Remaining Phase 0 work

Repeat input-to-paint measurements on the user's Pixel in Chrome, desktop
Chrome, and an authenticated session. Collect more natural runtime lifecycles
before setting memory, GC, or event-loop thresholds. Correlating tournament or
training workload with gameplay still requires topology evidence and a
controlled non-production experiment; source timestamps alone do not prove
shared compute or causation.
