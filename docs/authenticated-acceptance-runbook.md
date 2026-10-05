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

## Operator console acceptance

Use the named allowlisted operator's real OAuth state. Run the read-only desktop
and mobile layout, keyboard focus, shared-data, and anonymous-denial checks:

```bash
AUTH_BASE=https://www.binary2048.com AUTH_OPS_ACCEPTANCE=1 npx playwright test -c playwright.authenticated.config.ts tests/authenticated/ops.browser.spec.ts
```

The ops tests are opt-in so ordinary-user acceptance does not require operator
privileges. They disable traces, screenshots, and video to avoid recording
operator data. A valid ordinary-user session must not be used as operator
acceptance evidence. Unit tests separately verify ordinary-user denial before
operations data loads. These browser checks cover keyboard access and semantic
structure; they do not constitute a complete screen-reader audit.

## Manual evidence still required

- Restart Chrome and confirm `/auth` remains authenticated.
- Sign out, verify protected actions return to signed-out messaging, then sign
  in again and confirm recovery.
- Repeat sign-in, refresh/resume, gameplay, and sign-out on Android Chrome.
- Record date, deployed commit, device/browser versions, pass/fail, and sanitized
  issue links in the acceptance evidence report.
