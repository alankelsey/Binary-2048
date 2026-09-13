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
- Finish a ranked game and submit it to the intended leaderboard namespace.
- Verify authorized user-data deletion separately from the read-only export test.
- Verify store, inventory, entitlements, and paid-feature behavior.
- Verify sign-out, expired-session behavior, and reauthentication.
- Repeat critical authentication and gameplay flows on Android Chrome.
