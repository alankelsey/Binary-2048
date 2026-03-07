# Subscription-First Fallback Plan

Use this plan when ad economics are poor or retention impact is unacceptable.

## Trigger conditions

Activate fallback if either condition holds for 2 consecutive monthly reviews:

- Net ad revenue below `$100/month` after infra/support/churn costs.
- Retention impact exceeds ad decision thresholds from `docs/ads-decision-and-format-policy.md`.

## Fallback strategy

1. Freeze ad rollout:
- disable rewarded ad prompts and reward endpoint exposure in UI.

2. Prioritize subscription conversion:
- highlight ad-free + quality-of-life value in paid tier.
- run low-friction subscription trial messaging.

3. Expand cosmetic-first monetization:
- themes, board skins, non-ranked visual packs.

4. Protect ranked integrity:
- keep ranked gameplay fully non-pay-to-win.

## Operational steps

- Set monetization mode flag to `subscription_first`.
- Pause ad experiments and archive latest ad telemetry snapshot.
- Publish player-facing note explaining ad reduction and focus on clean gameplay.

## Success criteria

- Monthly revenue reaches or exceeds `R_break_even` from `docs/monetization-targets.md`.
- D1/D7 retention stabilizes or improves versus ad-test period.
