# Dev Environment Blueprint

Goal: isolate iteration from production by using a dedicated Amplify branch/app environment.

## Target Topology

- Production:
  - Branch: `main`
  - Domain: `www.binary2048.com`
  - Secrets path: `/amplify/dzxvs1esr22z9/main/*`
- Development:
  - Branch: `dev`
  - Domain: `dev.binary2048.com`
  - Secrets path: `/amplify/dzxvs1esr22z9/dev/*`

## Required Controls

- Separate env vars/secrets for `dev` and `main`.
- Separate OAuth callback for dev:
  - `https://dev.binary2048.com/api/auth/callback/github`
- WAF enabled on both; stricter limits on `dev` for bot tests.
- Dev data isolation:
  - Use test Mongo DB namespace (`binary2048_dev`).
  - Disable prod leaderboard writes from dev.

## Provisioning Checklist

1. Create Amplify `dev` branch and enable auto-build.
2. Attach `dev.binary2048.com` to `dev` branch.
3. Set `AUTH_SECRET`, `NEXTAUTH_SECRET`, provider IDs/secrets for `dev`.
4. Point `NEXTAUTH_URL` to `https://dev.binary2048.com`.
5. Run post-deploy checks on dev:
   - `ops:prod:smoke` with `PROD_BASE=https://dev.binary2048.com`
   - `ops:release:auth-check` with `PROD_BASE=https://dev.binary2048.com`
6. Restrict dev access (optional): basic auth/IP allow list.

## Promotion Policy

- Dev-first merge gate:
  - Unit + build + dev smoke pass before merge to `main`.
- No direct edits on prod env vars; changes tested in dev first.
- Rehearse rollback in dev before prod rollout changes.
