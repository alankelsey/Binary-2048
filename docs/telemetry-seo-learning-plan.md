# Telemetry, SEO, and Product Learning Plan

## Goals

- Improve discoverability and conversion without hurting gameplay UX.
- Measure where users drop off and which features retain players.
- Build safe training signals for bots/models without collecting sensitive data.

## Telemetry Scope

- Core gameplay: `game_created`, `move_submitted`, `move_noop`, `game_over`, `game_win`, `undo_used`.
- Replay flow: `replay_imported`, `replay_play_started`, `replay_share_clicked`.
- Growth: `landing_view`, `open_full_app_clicked`, `social_share_clicked`.
- Commerce/auth: `auth_signin_start/success`, `store_viewed`, `purchase_attempt/success`.
- Reliability: client-side and API error envelopes by route/version.

## Data Safety Baseline

- No raw PII in telemetry payloads.
- Use anonymized actor ids and coarse geo/device categories.
- Retain raw events short-term; keep aggregated tables long-term.
- Keep model-training joins behind explicit consent/tier flags.

## SEO Baseline

- Ensure indexable static pages for landing/docs/marketing routes.
- Add `sitemap.xml`, `robots.txt`, canonical tags, and social preview metadata.
- Add structured data for `SoftwareApplication` and site identity.
- Monitor search console crawl/index coverage and fix regressions quickly.

## Product Learning Loop

- Weekly dashboard review:
  - activation: first move within first session
  - retention proxy: next-day return
  - replay/share adoption
  - conversion to auth and paid features
- Monthly balancing review:
  - no-op rate by difficulty/mode
  - win/loss distribution
  - bot vs human behavior divergence

## Suggested Rollout Order

1. Event taxonomy + ingest endpoint + storage.
2. Dashboard + alerts for key funnels.
3. SEO baseline assets and search-console verification.
4. A/B test scaffold for UI copy/layout changes.
5. Training-data policy and consent-aware joins.
