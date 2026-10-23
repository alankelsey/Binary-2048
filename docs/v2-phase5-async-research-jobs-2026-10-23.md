# V2 Phase 5 asynchronous research jobs — 2026-10-23

## Scope and contract decision

This slice closes only the fourth Phase 5 item: synchronous long-running
research endpoints become job submission, status, and result APIs. The contract
was fixed before operator clients changed:

- production `POST /api/simulate`, `POST /api/bots/tournament`, and both
  training generators return `202` job submissions;
- every accepted response contains `jobId`, `statusUrl`, `resultUrl`, and a
  two-second retry hint;
- `GET /api/jobs/{id}` reports state and advertises `resultUrl` when complete;
- `GET /api/jobs/{id}/result` returns `202` while pending, `200` with the
  completed result, `409` for failed work, and `404` for unknown, expired, or
  differently owned work;
- both reads require `jobs:read`, enforce the submitting principal, share the
  existing polling quota, and keep the 24-hour TTL and 12 MiB result cap; and
- unversioned status retains its existing inline `result` on completion as a
  deprecated compatibility field. Updated clients send
  `x-binary2048-job-contract: 2`, receive lightweight status, prefer
  `resultUrl`, and fall back to the inline field when talking to an older
  deployment.

The non-SQS local-development fallback remains synchronous so deterministic
development and tests need no cloud dependency. This is compatibility behavior,
not the production execution model.

## Synchronous-work inventory and decision

`POST /api/simulate` was the sole remaining scoped compute route that could run
a long CPU loop in an Amplify request: the 2,000-move cap bounded cost but did
not isolate it. Submission now performs only authorization, challenge, quota,
body-cap, and deterministic input/configuration preflight before enqueuing an
owned `simulation` task. The existing compute queue carries simulations and
tournaments; training keeps its separate queue. The worker retains the existing
two-attempt, daily-principal, shared-monthly, TTL, payload, and result caps.

The other reviewed paths stay synchronous by design:

- replay ingest is a 100-record/1 MiB bounded operator database import, not a
  compute generator;
- model registry listing is capped metadata-only I/O;
- replay validation, scenario execution, gameplay, encoding, and action-mask
  endpoints are cheap deterministic product operations rather than scoped
  research batch work; and
- operator model-training and external-inference scripts execute in their own
  operator/provider processes, not inside the gameplay web runtime.

## Compatibility and drift boundary

Scope grants remain separate from API-key quota identity. New jobs remain bound
to the submitting principal, admins retain their explicit override, and
ownerless pre-deployment jobs retain only their existing 24-hour compatibility
window. Submission body/cost caps run before budget reservation. The OpenAPI
contract, developer guide, operator polling client, machine inventory, route
drift gate, and ownership tests change together.

## Validation and delivery-efficiency measurement

Focused route, worker, OpenAPI, inventory, and compatibility validation passed.
The final full unit gate passed at 175 suites / 670 tests. The operator-client
suite passed three tests, type generation and TypeScript passed, and the worker
bundle compiled. The full browser gate passed 77 tests with two expected skips
after the known macOS Chromium sandbox denial was retried at host level. The
optimized production compile and build smoke passed with the existing lint
warnings and the disposable authentication environment present from the start.

Discovery stayed in bounded batches below 5,000 returned tokens. The first UI
attempt produced verbose sandbox-denial output before the concise host retry;
the full gates were also repeated after tightening the compatibility contract
so contract-v2 status omits the stored result. These environment and deliberate
final-hardening repetitions preserve release confidence but do not establish a
35% output-token reduction. The measured delivery-efficiency comparison remains
open.

V2 progress is 38/84 (45.2%), and whole-roadmap progress remains 347/374 (93%).

## Production acceptance

Worker artifact
`8f6516ee0172dbef4e139fc84448f2b2b03dd1b980805af7804af55e33b00a21`
updated the `binary2048-v1-workers` stack successfully. Production worker
acceptance then completed simulation, tournament, training-replay, and
training-label jobs on the first attempt and removed its temporary records.

Runtime commit `1cf07b348b7c4f09377f497a6096323db595865f` deployed
successfully in Amplify job 431. The watcher enforced the full commit id and
reported success after 183 seconds. The standard production gameplay smoke
passed. A credential-safe live acceptance then verified:

- anonymous simulation is denied with 401;
- authorized simulation returns `202` with status and result URLs;
- contract-v2 status completes without an inline result;
- the dedicated result route returns the expected `binary2048-v1` artifact;
- anonymous reads of both the owned status and result are denied with 401; and
- production OpenAPI publishes the simulation `202` and job-result operation.

The final evidence deployment is recorded after its exact Amplify job passes.
