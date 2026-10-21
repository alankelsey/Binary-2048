# V2 Phase 5 OpenAPI contract metadata — 2026-10-21

## Scope

This slice completed the first Phase 5 item by auditing the published contract
for 24 gameplay, replay, persisted-run, simulation, job, training, tournament,
and model-research operations.

## Contract behavior

- Each audited operation publishes its actual authentication mode, required
  scopes, deployed default rate-limit or body/cost cap, compatibility version,
  and safe request/response examples.
- Optional bot keys are represented as `botApiKey` or anonymous fallback in
  standard OpenAPI `security`. Admin model access requires `adminBearer` and
  the `admin` scope. Public and opaque-capability routes are labeled explicitly.
- Reusable components describe bot, bearer, admin, and Auth.js session security
  plus shared API failure, rate-limit failure, queued job, state identity, and
  replay-envelope schemas.
- Safe examples appear in standard request and response content as well as the
  explorer. Error responses reference the shared API or rate-limit failure
  shapes.
- Training query bounds and the observed 403/429/500/503 outcomes are now
  explicit. Simulation, tournament, import, replay, and postmortem body/cost
  limits and failure statuses are also explicit.

## Security findings

The audit records current deployed behavior without implying stronger controls:

- simulation, tournament, and training routes accept an optional API key and
  otherwise use IP/account fallback quotas plus challenge policy;
- those research routes do not yet enforce a research authorization scope;
- replay ingest is currently public and has neither a route-local quota nor a
  request-body cap; and
- job reads use an opaque 256-bit identifier as a capability and share the move
  quota implementation.

These findings feed the next Phase 5 inventory and authorization item. No live
request execution was added to the explorer.

## Automated evidence

- `openapi-contract-metadata.test.ts` requires complete policy metadata for all
  24 priority operations, verifies reusable components and standard examples,
  and prevents the contract from overstating replay-ingest or simulation auth.
- The exact 60-operation route drift gate remains in place.
- The explorer browser test verifies that audited auth, quota, and version
  metadata are visible while the explorer remains read-only.
- Focused contract validation passed: 4 suites, 34 tests. Full validation
  passed: 171 unit suites / 652 tests, 77 UI tests with two expected skips,
  TypeScript, optimized production compilation, and build smoke.

## Delivery-efficiency measurement

- Discovery used three batched reads. The first combined output exceeded the
  5,000-token target, so the 35% delivery-efficiency target is not claimed.
- Focused contract/type validation ran twice, the focused browser test once,
  and each full release gate once.
- The optimized production build and smoke passed on the first run.
- No missed dependency or release defect was found. The next slice must cap the
  combined output of a parallel discovery batch, not only each child command.
