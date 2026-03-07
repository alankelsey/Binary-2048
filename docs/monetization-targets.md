# Monetization Targets (Cost-Coverage First)

This document defines the monthly cost target and break-even revenue target for Binary-2048.

## Monthly cost target

Use conservative launch assumptions and update monthly.

- Hosting + compute (Amplify/CloudFront/API): `$75`
- Observability + logs + alarms: `$25`
- Tooling/services (email, misc SaaS): `$20`
- Support/ops contingency: `$30`

Baseline monthly cost target:

- `C_month = $150`

## Break-even revenue target

Define support margin:

- `M_support = 20%`

Break-even target:

- `R_break_even = C_month * (1 + M_support)`
- `R_break_even = 150 * 1.20 = $180/month`

## Working KPI targets

- Minimum revenue target (hard floor): `$180/month`
- Healthy target (buffer for growth spikes): `$250/month`
- Stretch target (reinvest in features): `$400/month`

## Revenue mix assumptions (initial)

Prioritize non-invasive monetization:

- Subscriptions: `60%`
- Cosmetic/item purchases: `35%`
- Optional rewarded ads: `<=5%` (only if economics justify UX cost)

## Review cadence

- Weekly: compare MTD revenue vs `R_break_even`.
- Monthly: revise `C_month` using real AWS + tooling invoices.
- If 2 consecutive months under break-even:
  - tighten cost controls,
  - delay non-essential infra spend,
  - prioritize conversion experiments before adding ad load.
