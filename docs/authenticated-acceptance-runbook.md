# Production Authenticated-User Acceptance

This audit uses a real GitHub OAuth session. The browser storage file contains
sensitive cookies and must remain under the Git-ignored `artifacts/` directory.
Never attach it to issues, logs, commits, or test reports.

## Current target status

- Custom domain `https://www.binary2048.com`: DNS and the public auth endpoints resolve.
- Amplify target `https://main.dzxvs1esr22z9.amplifyapp.com`: `/auth`, sign-in,
  session, and provider-discovery checks passed; GitHub was advertised.
- GitHub's OAuth callback issuer is explicitly configured as
  `https://github.com/login/oauth`, matching GitHub's RFC 9207 callback value.

Confirm that the GitHub OAuth application allows the callback URL used by the
deployed `NEXTAUTH_URL` before capturing a session.

## Capture a real session

```bash
AUTH_BASE=https://www.binary2048.com npm run ops:auth:capture
```

Complete GitHub login and any MFA prompt. Wait until `/auth` displays
`Authenticated: yes`, then close the browser. This saves local state to
`artifacts/auth-acceptance/storage-state.json`.

## Run the non-destructive automated audit

```bash
AUTH_BASE=https://www.binary2048.com npm run ops:auth:acceptance
```

The audit verifies the real session and tier, refresh persistence, bridge-token
minting, protected read-only data export, and ranked-session creation. It never
prints the token and does not delete data or submit leaderboard entries.

## Manual evidence still required

- Restart Chrome and confirm `/auth` remains authenticated.
- Complete one ranked game and submit it; record the resulting player identity
  and leaderboard namespace without recording private email/token values.
- Inspect store/inventory behavior for the account's actual tier.
- Sign out, verify protected actions return to signed-out messaging, then sign
  in again and confirm recovery.
- Repeat sign-in, refresh/resume, gameplay, and sign-out on Android Chrome.
- Record date, deployed commit, device/browser versions, pass/fail, and sanitized
  issue links in the acceptance evidence report.
