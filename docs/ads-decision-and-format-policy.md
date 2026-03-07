# Ads Decision and Format Policy

This policy controls whether Binary-2048 ships ads at all, and what ad formats are allowed.

## 1) Decision gate (go/no-go)

Ads can ship only if all conditions pass:

- Projected net monthly ad revenue is above UX-cost threshold:
  - `net_ad_revenue = gross_ad_revenue - infra_cost_delta - support_cost_delta - churn_cost_delta`
  - Require `net_ad_revenue >= $100/month` **and** positive vs subscription-first baseline.
- Retention impact stays bounded in A/B test:
  - D1 retention drop <= 2 percentage points
  - D7 retention drop <= 3 percentage points
- No ranked-integrity risk introduced by ad rewards.

If any condition fails, do not ship ads and keep subscription/cosmetic-first path.

## 2) Allowed ad format

If ads are enabled, Binary-2048 uses **rewarded ads only**.

Allowed:

- Opt-in rewarded ad view initiated by player action.
- Reward granted only after verified completion.

Not allowed:

- Interstitial ads between moves.
- Forced pre-roll on app load.
- Mid-game pop-up/video interruptions.
- Any ad placement that blocks core gameplay flow without explicit user consent.

## 3) UX guardrails

- Hard cap rewarded views per user/day.
- Cooldown between rewarded views.
- No ad prompts on game-over/win overlay by default (opt-in button only).
- Free-tier only ads policy:
  - `guest` users may see opt-in rewarded ads (if ads are enabled).
  - `authed` users may see opt-in rewarded ads unless they are paid.
  - `paid` users must always receive ad-free gameplay.
- Server-verified reward grant path:
  - Rewards are granted only through `POST /api/ads/reward`.
  - Requires server-side HMAC signature verification (`x-binary2048-ad-sig`).
  - Anti-fraud checks enforce nonce replay protection, payload freshness, cooldown, and daily cap.
  - Ranked integrity rule: undo-assisted runs are excluded from `ranked_pure` leaderboard bracket.

## 4) Review cadence

- Re-evaluate gate monthly using:
  - `docs/monetization-telemetry-baseline.md`
  - `docs/monetization-targets.md`
  - latest ad payout snapshot
