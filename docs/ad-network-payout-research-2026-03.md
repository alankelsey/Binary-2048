# Ad Network Payout Research (Rewarded Video) - March 2026

Snapshot date: `2026-03-07`

This is a directional benchmark for deciding whether rewarded ads are worth shipping.

## Findings (directional)

- Rewarded video eCPM varies heavily by:
  - platform (`iOS` typically higher than `Android`),
  - geo (`Tier-1` countries usually much higher than long-tail geos),
  - fill rate and session depth.
- For planning, expect very wide ranges and high volatility month-to-month.
- Decision implication:
  - only ship rewarded ads if projected net revenue is materially above UX cost and engineering/ops overhead.

## Planning ranges for Binary-2048

Use these conservative planning bands until we have first-party data:

- Tier-1 geos (US/CA/UK/AU):
  - rewarded video eCPM planning band: `$8-$25`
- Mid-tier geos:
  - planning band: `$3-$10`
- Long-tail geos:
  - planning band: `$0.5-$4`

These are planning assumptions, not contractual payouts.

## Recommended decision gate

Before enabling ads in production:

1. Run a 2-4 week A/B test with rewarded-only placements.
2. Measure:
  - incremental ARPDAU,
  - D1/D7 retention delta,
  - session length delta,
  - payer conversion cannibalization.
3. Ship ads only if:
  - net revenue gain remains positive after churn/retention impact,
  - ranked integrity remains unaffected.

## Sources

- Google AdMob docs (reporting/export APIs for first-party monetization measurement):
  - https://developers.google.com/admob/api/v1/getting-started
- TopOn 2025 monetization report landing page (geo/platform rewarded benchmark context):
  - https://www.toponad.com/benefits-and-opportunities-of-launching-applications-globally-h1-2025/
- Playwire 2025 ad monetization benchmark article (industry directional ranges):
  - https://www.playwire.com/blog/ad-monetization-benchmarks-report-2025

Inference note:
- The planning bands above are inferred from third-party benchmark-style sources and should be replaced with Binary-2048 first-party data as soon as ad experiments begin.
