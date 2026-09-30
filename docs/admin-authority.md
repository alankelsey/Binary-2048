# Server-Verified Admin Authority

Binary 2048 uses one centralized, fail-closed authorization contract for
administrative routes. Normal account tiers (`guest`, `authed`, and `paid`),
store entitlements, and `NEXT_PUBLIC_UI_ADMIN_MODE` never grant admin access.
The public UI flag controls developer-facing visibility only.

## Accepted authorities

An administrative request must satisfy exactly one of these server-side paths:

1. **Service automation:** `x-admin-token` must match the non-empty
   `BINARY2048_ADMIN_TOKEN`. Comparison uses fixed-length SHA-256 digests and
   Node's timing-safe comparison. This path preserves the guarded production
   acceptance scripts and must not be used by browser code.
2. **Named operator:** a bearer token must pass the existing auth-bridge
   signature and expiry checks, and its exact `sub` must appear in
   `BINARY2048_ADMIN_SUBJECTS`. The allowlist accepts comma- or newline-separated
   subjects, trims surrounding whitespace, and remains case-sensitive.

Both environment variables are server-only. Never prefix them with
`NEXT_PUBLIC_`, put either value in client storage, include them in URLs, or
log them. A user being paid or authenticated is insufficient unless the
verified subject is separately allowlisted.

## Failure behavior

- Missing configuration fails closed.
- Missing, malformed, incorrectly signed, or expired bearer credentials fail
  closed.
- Spoofed subject headers are ignored.
- A wrong service token does not fall through to any account-tier check.
- Routes return the same generic `401 Admin authorization required` response;
  they do not reveal which authority path or configuration was absent.
- Admin authorization failures return `Cache-Control: no-store` so an anonymous
  denial cannot be reused for a later authorized request by an intermediary.

## Operations

- Keep `BINARY2048_ADMIN_TOKEN` high entropy and rotate it through the existing
  guarded Amplify workflow.
- Add a human operator only by placing the exact OAuth bridge subject in
  `BINARY2048_ADMIN_SUBJECTS` and redeploying. Remove the subject and redeploy
  to revoke access.
- Keep the allowlist minimal and review it whenever OAuth identities or
  providers change.
- The future operations console must use this module on every server route;
  hiding navigation or checking client state is never authorization.
- `GET /api/ops/storage/status` is passive and performs no connectivity test or
  write. `POST /api/ops/storage/smoke` is the separately named active
  write/read/delete probe and must not be placed on a normal console refresh
  loop.

The implementation lives in `lib/binary2048/admin-auth.ts`. Existing league,
storage, quota-probe, and inventory-grant routes all delegate to it.
