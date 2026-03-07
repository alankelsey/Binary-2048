# Monetization Telemetry Baseline

This baseline defines the minimum metrics required before enabling monetization experiments.

## Core metrics

- `ARPDAU proxy`:
  - `(adRevenueUsd + purchasesUsd) / activeUsers`
- `Conversion rate`:
  - `uniquePayers / activeUsers`
- `Subscriber rate`:
  - `subscribers / activeUsers`
- `D1 retention` and `D7 retention`
- `D1 churn` and `D7 churn` (`1 - retention`)

## Implementation

- Metric calculator utility:
  - `lib/binary2048/monetization-metrics.ts`
- Unit tests:
  - `lib/binary2048/monetization-metrics.test.ts`

## Event inputs required

- Daily active users (`activeUsers`)
- Ad revenue USD (`adRevenueUsd`)
- Purchase revenue USD (`purchasesUsd`)
- Unique payers (`uniquePayers`)
- Active subscribers (`subscribers`)
- Retained users day 1/day 7 (`retainedUsersD1`, `retainedUsersD7`)

## Baseline alert thresholds (starting point)

- ARPDAU proxy drop > 25% week-over-week
- Conversion rate drop > 20% week-over-week
- D1 retention drop > 15% week-over-week
- D7 retention drop > 15% week-over-week

Tune thresholds after 4 weeks of production data.
