# V2 Phase 4 asynchronous authentication shell — 2026-10-20

Status: complete. This closes Phase 4.

## Rendering boundary

The root layout no longer awaits an Auth.js session lookup. It renders the game
and a fail-closed client auth shell immediately. After hydration, the auth shell
requests the standard same-origin Auth.js session endpoint and transitions from
pending to authenticated, guest, or error.

Pending auth displays `Checking account…`. A failed lookup displays an alert
and Retry button while keeping `data-authenticated="false"`. A successful
response becomes authenticated only when the canonical auth-state normalizer
finds a user object; null, empty, malformed, signed-out, and expired-session
responses remain guest. This fixed an existing edge case where an empty object
could be interpreted as authenticated.

The game page observes the auth shell through an explicit browser event plus a
DOM attribute observer. Import remains hidden until a positive authenticated
state arrives. The client bridge also checks the fail-closed DOM state before
requesting a bearer token. Server routes retain their existing required-session
checks and remain authoritative.

## Guest-safe and protected surfaces

Board rendering, New Game, tutorial, replay import, help, support diagnostics,
sharing, keyboard/touch controls, local prediction, and normal guest gameplay
do not depend on auth hydration. Auth display, sign-in/sign-out links, and
authenticated game import hydrate asynchronously. Account data, store,
leaderboard, ops, and other protected endpoints continue to authorize on the
server.

## Timing evidence

The game marks `binary2048:game-shell-ready` in its first layout effect. The
auth shell separately marks hydration start and completion. A browser test
holds the session response for 750 ms and proves the New Game control and shell
readiness mark exist while auth completion is still absent. Completion follows
shell readiness by at least 500 ms in that controlled run, demonstrating that
auth latency is outside the game-shell readiness path.

No move, prediction, persistence, or input-queue code changed. Phase 4's prior
diagnostic-ring tests continue to prove that a closed panel performs no full-log
formatting per move, while optional-tool tests cover open/close isolation.

## Acceptance evidence

- Auth unit coverage proves absent and empty session payloads fail closed while
  real user sessions preserve authenticated tiers.
- Focused browser coverage proves delayed guest hydration, authenticated
  control reveal, failure plus retry, and empty expired-session handling.
- Existing guest bridge coverage proves starting a guest game does not request
  an authenticated bridge token.
- Full validation and production acceptance are recorded below.

## Delivery-efficiency pilot

Discovery used four bounded command groups, with one combined auth-consumer
search exceeding the 5,000-token target. Focused validation used one auth unit
run and two browser iterations; the first browser iteration exposed the empty
session fail-closed defect. The 35% comparison remains open.

## Validation

- Focused auth/security suites: 4 suites / 11 tests passed.
- Focused asynchronous-auth browser suite: 4 tests passed.
- Full unit suite: 169 suites / 623 tests passed.
- Full local browser suite: 76 tests passed, 2 expected support-configuration
  skips.
- Dedicated support-log suite: 2 tests passed, 1 expected configuration skip.
- TypeScript, changed-file lint, and optimized production build smoke passed;
  changed-file lint retained two pre-existing hook warnings.
- The optimized build now classifies `/` as static instead of dynamic because
  the root layout no longer performs a request-time session lookup.
