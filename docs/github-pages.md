# GitHub Pages Setup

This repo includes a static Pages site in `gh-pages/` that acts as a product intro page and links into the live app (`https://binary2048.com`).

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
  - runs a short non-playable animated board demo (JS loop)
  - provides direct `Open Full App` CTA to production app

## Notes

- This avoids iframe policy issues (`X-Frame-Options`, `CSP frame-ancestors`) by design.
- Keep this page lightweight and static so it remains reliable even when app/API incidents occur.
