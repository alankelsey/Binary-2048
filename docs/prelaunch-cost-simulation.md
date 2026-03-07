# Pre-Launch Cost Simulation Checklist

Use this checklist before public launch to cap financial risk from bot spikes and abuse traffic.

## Inputs (fill these first)

- Date/time window tested:
- Environment tested (`staging` or `prod-off-peak`):
- AWS region(s):
- Expected DAU (week 1):
- Expected peak RPS (gameplay routes):
- Expected peak RPS (heavy routes):

## Cost envelope model (daily)

Define:

- `G = daily gameplay requests` (`/api/games`, `/api/games/:id/move`)
- `H = daily heavy requests` (`/api/simulate`, `/api/bots/tournament`)
- `Cg = estimated cost per gameplay request`
- `Ch = estimated cost per heavy request`
- `F = fixed daily cost` (domain, baseline hosting, logs)

Envelope:

- `daily_estimated_cost = (G * Cg) + (H * Ch) + F`
- `hard_daily_spend_limit = daily_estimated_cost * 1.5` (50% safety margin)

If `daily_estimated_cost` already exceeds budget target, do not launch.

## Test profiles required

1. Baseline profile
- Run: `npm run load:baseline`
- Capture p95, error rate, and total request count.

2. Staged gameplay profile
- Run: `BASE_URL=<target> npm run load:stage:gameplay`
- Save `docs/load-results/staged-gameplay-latest.*`.

3. Heavy abuse profile
- Run: `BASE_URL=<target> npm run load:stage:abuse`
- Save `docs/load-results/heavy-abuse-latest.*`.

## Spend guardrails (must be configured)

- AWS Budget monthly alerts at 50/80/100%.
- Daily spend alert threshold set at `hard_daily_spend_limit`.
- WAF rate limits active.
- Endpoint cost caps active (`moves`, `seedCount`, `maxMoves`).
- Degrade kill-switches documented and tested.

## Go / no-go gates

Launch only if all are true:

- Heavy abuse test passes (no disallowed responses, 5xx below threshold).
- `daily_estimated_cost <= hard_daily_spend_limit`.
- Billing alert channel (SNS/email) verified.
- On-call action exists for degrade-mode activation within 10 minutes.

## Evidence to archive

- Links to load artifacts:
  - `docs/load-results/staged-gameplay-latest.md`
  - `docs/load-results/heavy-abuse-latest.md`
- Screenshot of AWS Budget alert rules.
- Screenshot/log of WAF associated with app.
- Final approved budget envelope values.
