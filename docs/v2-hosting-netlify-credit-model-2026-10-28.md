# Netlify credit-model evidence (2026-10-28)

Status: pricing model recorded; no hosting recommendation is made without the
shared measured 30-day workload required by the V2 plan.

## Current first-party model

Netlify's current self-service plans use credits, not the legacy bandwidth and
build-minute allowances. The [official pricing page](https://www.netlify.com/pricing/)
lists a hard 300-credit monthly limit for Free, 1,000 included credits for the
$9/month Personal plan, and Pro starting at $20/month with 3,000 credits.
Free projects pause after exhausting the monthly limit. Optional recharge is
not available on Free; paid tiers can add credits when recharge is enabled.

The [credit documentation](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)
defines these workload rates:

| Meter | Credits |
| --- | ---: |
| Successful production deployment | 15 each |
| Deploy preview or branch deployment | 0 |
| Function/preview/database compute | 10 per GB-hour |
| Web and database bandwidth | 20 per GB |
| Web requests, including functions and assets | 2 per 10,000 |

Failed production deployments and rollbacks do not consume deployment credits.
Compute is allocated memory multiplied by execution duration, so request count
alone cannot estimate function cost.

## Reusable workload formula

For a measured month:

`credits = 15 × production deploys + 10 × GB-hours + 20 × outbound GB + 2 × requests / 10,000`

The same measured workload must be used for every hosting candidate. For
Netlify, report both the credit result and behavior at the plan boundary:

- Free is eligible only if the product classification permits it and the total
  stays at or below 300 credits; exhaustion pauses projects.
- Personal includes 1,000 credits; recharge is optional and therefore must be
  modeled both disabled (hard stop) and enabled (variable spend).
- Pro begins with 3,000 credits and must include its base subscription even if
  measured usage is lower.

This item records the pricing function only. Production usage, commercial
classification, observability needs, and a proof deployment remain separate
gates.
