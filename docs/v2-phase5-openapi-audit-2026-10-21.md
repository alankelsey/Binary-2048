# V2 Phase 5 OpenAPI audit and explorer prototype — 2026-10-21

## Scope

This slice audited the implemented App Router HTTP methods against the
published OpenAPI object and replaced the static API card list with an
interactive explorer generated from that same object.

## Findings and changes

- The application has 60 explicitly exported HTTP operations. The audit found
  six missing contract operations: recovery export, league configuration
  mutation, rate-limit probe, leaderboard storage probe, replay ingest, and
  the signed store webhook.
- All six operations are now represented in `OPENAPI_SPEC` with parameters,
  request-body shape where applicable, and observed response statuses.
- `openapi-drift.test.ts` recursively inventories `app/api/**/route.ts`,
  normalizes dynamic segments, and requires the implemented and documented
  operation sets to match exactly. The Auth.js catch-all route is composed by
  the framework rather than an explicit local method export and is outside the
  application contract.
- `/api-docs` now supports accessible text filtering and expandable operation
  details for parameters, request bodies, and responses. It does not execute
  mutating or privileged requests in this prototype.

## Validation

- Focused OpenAPI and drift tests: 3 suites, 6 tests passed.
- API explorer browser test covers filtering, expansion, contract detail, and
  the empty result state.
- Full release validation: 170 unit suites / 624 tests, 77 UI tests with two
  expected skips, TypeScript, and optimized production compilation passed.
  The build smoke exposed that its isolated process no longer supplied an auth
  provider or bridge secret. It now supplies disposable local-only values and
  accepts the route's explicit fail-closed 503 when an isolated production
  server cannot complete session lookup; other 503 bodies still fail.
- Runtime commit `ed7a0c8` deployed successfully in Amplify job 423. The
  watcher enforced the full commit id and reported success after 185 seconds;
  the production smoke then passed against `https://www.binary2048.com`.

## Delivery-efficiency pilot

- Discovery used four batched reads; one initial source read exceeded the
  5,000-token target before the audit was narrowed.
- Focused tests ran three times while correcting one syntax error and two
  browser-test assumptions. The full unit and UI gates ran once.
- Production compilation ran three times while the smoke dependency and its
  fail-closed behavior were identified; the final smoke ran after the harness
  fix against the last successful compilation.
- No production dependency was missed, but this slice does not meet the 35%
  output-token target because of the oversized discovery read and repeated
  build output. The delivery-efficiency roadmap item remains open.

## Remaining Phase 5 contract work

The Phase 5 contract checkbox remains open. The current spec still needs a
systematic operation-level audit for authentication scheme, authorization
scope, exact rate-limit policy, safe examples, shared error schemas, and
version compatibility. Canonical application schemas should replace generic
`type: object` placeholders where practical before the explorer permits live
requests.
