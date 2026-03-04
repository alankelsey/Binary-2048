# GitHub Pages Setup

This repo includes a static Pages site in `gh-pages/` that embeds the live app (`https://binary2048.com`) in an iframe.

## Enable once in GitHub

1. Open repo `Settings -> Pages`.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Save.

## Deploy flow

- Workflow: `.github/workflows/github-pages.yml`
- Triggered on:
  - pushes to `main` that change `gh-pages/**`
  - manual `workflow_dispatch`

## Page content

- Entry file: `gh-pages/index.html`
- UX behavior:
  - shows branded landing page
  - attempts playable embed of `https://binary2048.com`
  - provides "Open Full App" fallback if embed is blocked

## Notes

- If your primary domain sends restrictive `X-Frame-Options` or `Content-Security-Policy frame-ancestors`, iframe embedding may fail.
- In that case, keep the Pages site as a launch/marketing page and route users via the full-app link.
