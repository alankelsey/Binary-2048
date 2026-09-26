# Production Authenticated Acceptance Evidence — 2026-09-13

## Scope

- Target: `https://www.binary2048.com`
- Deployed commit: `c1b7579`
- Amplify release job: `287` (`SUCCEED`)
- Identity provider: GitHub OAuth
- Session state: captured locally under the Git-ignored `artifacts/auth-acceptance/` directory
- Sensitive cookies, tokens, email addresses, and account identifiers are intentionally excluded from this report.

## Automated acceptance result

Command:

```bash
AUTH_BASE=https://www.binary2048.com npm run ops:auth:acceptance
```

Result: **4 passed**.

1. The real OAuth session was authenticated and survived refresh.
2. The authenticated session minted a short-lived bridge token.
3. The bridge identity authorized protected, read-only user export.
4. The real authenticated identity created a ranked session with an authenticated user tier.
5. An authenticated ranked move returned `RateLimit-Scope: account`, the
   resolved `RateLimit-Tier`, and the matching tier limit. The account quota key
   is a SHA-256 hash and neither the key nor account identifier is returned to
   the client.

The ranked move supplied the create response's compact recovery snapshot. This
keeps the acceptance check valid when Amplify sends creation and movement to
different instance-local session stores.

## Ranked submission acceptance

- Deterministic seed: `91001`
- Rules: canonical ranked classic rules; custom board size, initial grid, and
  win conditions are rejected
- Play policy: engine-evaluated legal moves with a 500-move safety bound
- Result: reached a genuine terminal state and submitted successfully
- Identity: real authenticated GitHub OAuth identity (value omitted)
- Quota: account-scoped authenticated tier
- Submission mode: `isPractice: true`
- Stored namespace: `sandbox`, as required by the practice-isolation policy
- End-to-end ranked test duration: 39.2 seconds

The run used server-signed compact recovery snapshots. The signature covers the
original session ID, deterministic configuration, initial grid, move history,
ranked integrity, and undo audit. Modified or unsigned snapshots are downgraded
to unranked imported sessions and cannot be submitted as `ranked_pure`.

This verifies submission behavior, not durable leaderboard retention. The
leaderboard store remains per-instance memory and must move to shared persistent
storage before a public ranked launch.

## Store, inventory, and paid-feature acceptance

The production suite passed the following checks using the captured real OAuth
session without purchasing, granting, or consuming inventory:

- Public catalog returned the configured packet list.
- Inventory API rejected a request without a bridge bearer token.
- Authenticated inventory resolved to a non-identifying `acct_` SHA-256 account
  id and returned the session's actual tier and entitlements.
- A request for a different subscriber id returned `403`.
- An authenticated non-admin inventory grant returned `401`.
- Direct grant-style purchase returned `503` because verified checkout is not
  configured, and no inventory was granted.
- The Store page loaded the authenticated account inventory and displayed the
  correct paid-feature message for the session's resolved tier.

The audit found and corrected unsafe placeholder behavior where store routes
trusted caller-supplied subscriber ids, inventory grants were unauthenticated,
direct purchase granted items without checkout, and an unconfigured webhook
failed open. These paths are now account-bound, admin-only, disabled by default,
or fail-closed as appropriate.

## Defect found and corrected

The first run returned `503` from `POST /api/auth/bridge-token`. The route's
bridge-signing secret existed in the Amplify branch configuration but was not
included in the values embedded into the Amplify WEB_COMPUTE SSR bundle.

Commit `c1b7579` adds `BINARY2048_AUTH_BRIDGE_SECRET` to the server bundle
configuration and adds a production-build smoke assertion. The smoke test now
requires an unauthenticated bridge-token request to reach Auth.js and return
`401`; a missing embedded bridge secret would instead return `503` and fail the
build.

## Remaining manual and destructive checks

- Verify account/key rate-limit attribution during authenticated gameplay.
- Verify authorized user-data deletion separately from the read-only export test.
- Repeat critical authentication and gameplay flows on Android Chrome.

## Desktop authentication lifecycle follow-up — 2026-09-25

The production lifecycle suite now uses the ignored real OAuth storage state to
verify three isolated desktop flows without logging cookie or token values:

1. Sign-out clears the application session, restores protected guest messaging,
   and makes bridge-token creation fail closed with `401`.
2. Expiring the captured application session cookie returns the UI to guest
   state, preserves the `401` protected response, and exposes the configured
   provider sign-in recovery screen.
3. A signed-out browser completes a real GitHub OAuth round trip using the
   locally retained provider session, restores the authenticated tier, and can
   mint a fresh bridge token.

The focused lifecycle run passed 3/3. The complete non-destructive production
authenticated suite passed 9/9, including session refresh, ranked practice and
sandbox submission, protected export, account-bound store reads, and fail-closed
paid mutations. The deployed production head was `88cb5ca`; no credentials,
cookie values, tokens, email addresses, or account identifiers were printed or
committed.
