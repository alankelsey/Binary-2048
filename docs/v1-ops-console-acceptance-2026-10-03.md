# V1 operations console acceptance

Date: 2026-10-03. Production target: `https://www.binary2048.com`.
Repository HEAD: `60bdc69` (the previously recorded production operator deployment).
This run did not independently query the deployment's commit or change production.

## Ops console: passed

The saved real OAuth session returned HTTP 200 with an authenticated user.
No refresh was needed for the current session. The read-only production ops
browser suite passed all three tests:

- At 1440×900 and 390×844, the operator saw shared data and the storage,
  activity, league, model, and leaderboard sections without page overflow.
- The activity table exposed column headers; keyboard focus moved from Refresh
  data to the table region with a visible outline. Refresh retained access.
- A separate anonymous context saw the access-required message, no storage
  section, and HTTP 401 from `/api/ops/storage/status`.

The existing ops rendering and admin authorization unit suites passed 7 tests,
including ordinary-user denial before data loads and missing-telemetry states.
TypeScript checking passed. This is targeted semantic and keyboard acceptance,
not a full screen-reader or physical-device audit. Traces, screenshots, and
video were disabled for the operator checks.

## Broader authenticated acceptance: incomplete

Command:

```bash
AUTH_BASE=https://www.binary2048.com AUTH_OPS_ACCEPTANCE=1 npx playwright test -c playwright.authenticated.config.ts --trace off
```

Result: 9 passed, 2 failed, 1 dependent test did not run.

- Passed: session/refresh, authenticated import UI, bridge minting, protected
  export, sign-out, expired-session denial/recovery entry, and the three ops checks.
- GitHub reauthentication stopped at the provider login page and timed out.
  Completing this check requires interactive provider authentication; the valid
  application session alone does not establish a valid GitHub provider session.
- The recovery-safe ranked practice test reached terminal state, but its
  leaderboard submission returned HTTP 409 instead of 200. Follow-up traced
  this to the submit route always rebuilding from the supplied recovery snapshot,
  which could replace a finished server session with an older browser snapshot.
  The local fix now uses the shared recovery resolver so the authoritative server
  session wins unless a newer trusted snapshot must be restored. Regression tests
  pass; deployment and production acceptance remain outstanding.
- The serial authenticated store/inventory test did not run after the practice
  submission failure.

The ops-console roadmap item is complete. V1 release acceptance remains open
until the submission failure is resolved, provider reauthentication is verified,
and the dependent store acceptance is rerun successfully. No payments, inventory
grants, data deletion, or infrastructure changes were performed.
