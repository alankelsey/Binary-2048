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
minting, protected read-only data export, and a recovery-safe ranked practice
run through terminal state and submission. The submission is automatically
routed to the sandbox namespace and excluded from ordinary standings. It also
checks account-bound inventory reads, cross-account denial, admin-grant denial,
disabled direct purchase, and the resolved-tier Store UI. The audit never prints
the token, changes inventory, initiates payment, or deletes user data.

## Manual evidence still required

- Restart Chrome and confirm `/auth` remains authenticated.
- Sign out, verify protected actions return to signed-out messaging, then sign
  in again and confirm recovery.
- Repeat sign-in, refresh/resume, gameplay, and sign-out on Android Chrome.
- Record date, deployed commit, device/browser versions, pass/fail, and sanitized
  issue links in the acceptance evidence report.
