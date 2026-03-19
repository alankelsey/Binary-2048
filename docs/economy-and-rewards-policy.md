# Binary-2048 Economy And Rewards Policy

## Decision

Binary-2048 should use a three-layer economy model and keep any external-value rewards isolated from ranked-pure competition.

The product should remain game-first. Any real-world value layer must be a controlled bonus, not the main incentive loop.

## Three-Layer Economy

### 1. Game Currency

This is the primary internal economy.

Examples:

- coins
- credits
- shards
- event tokens

Game currency is earned through normal play and used for:

- cosmetics
- optional sandbox modifiers
- event entry
- unlockable non-ranked content

### 2. Premium Currency

This is purchased value used for optional perks.

Examples:

- cosmetic bundles
- supporter packs
- sandbox boost packs
- seasonal access

Premium currency must not create pay-to-win ranked outcomes.

### 3. External Reward Currency

If shipped later, this is a separately governed reward rail such as Lightning/sats or another cash-adjacent reward system.

This layer must be:

- capped
- budgeted
- abuse-resistant
- optional
- isolated from ranked-pure balance

## Internal Ledger Schema

Any value-like economy requires a ledger, even before crypto or cash-out.

Minimum transaction record:

- `id`
- `userId`
- `timestamp`
- `type`
- `currency`
- `amount`
- `reason`
- `sourceId`
- `balanceBefore`
- `balanceAfter`
- `metadata`

Transaction types should include:

- reward
- purchase
- grant
- consume
- refund
- penalty
- withdrawal
- reversal

Ledger records must be append-only. Corrections are new records, not destructive edits.

## External Reward Rails Decision

If Binary-2048 ever offers real-world value rewards, the preferred first rail is a low-friction off-platform payout such as Lightning/sats.

Why:

- small-value transfers are viable
- supports tournament and challenge payouts
- lower friction than traditional payout rails for micro-rewards

But this is only acceptable if:

- abuse controls are in place
- reward pool budget is explicit
- withdrawal minimums exist
- legal/compliance review is completed

If those controls are not ready, stay internal-only.

## Reward Pool Sustainability

Any external reward pool must be explicitly budgeted.

Required budget model:

1. gross revenue
2. operations reserve
3. reward reserve
4. discretionary margin

Rules:

- rewards never exceed configured reserve
- daily and monthly payout caps exist
- emergency kill switch exists
- sponsored or promotional pools are tracked separately

## Withdrawal Policy

If withdrawals are enabled later, require:

- minimum withdrawal threshold
- cooldown between withdrawals
- CAPTCHA or challenge at withdrawal
- fraud and velocity review
- abuse flagging
- manual hold capability for suspicious cases

If regulation or payment-partner requirements demand identity verification, withdrawals stay disabled until that work is complete.

## Proof-Of-Play Model

Binary-2048 should prefer proof-of-play, not browser mining.

Required shape:

- server verifies game creation and move flow
- reward claims derive from canonical runs
- replay and audit trails support payout review
- capped earning windows prevent passive farming

This preserves product integrity and avoids hostile browser-mining UX.

## Anti-Farm Controls

If any reward system exists, add:

- daily earning caps
- per-IP and per-account velocity checks
- CAPTCHA on sensitive reward actions
- suspicious pattern scoring
- replay validation before payout
- guest restrictions for any cash-adjacent feature

Paid users may receive convenience benefits, but they must not bypass fraud controls entirely.

## Bot Tournament Prize Model

Bot tournaments should start with internal rewards only.

External payouts for bots should remain disabled until:

- benchmark integrity is stable
- tournament abuse model is proven
- duplicate-account farming is controlled
- prize accounting is audited

Internal-first is the correct order.

## Ranked Isolation Rule

All external-value rewards must remain segregated from ranked-pure play.

That means:

- ranked-pure does not include paid boosts
- ranked-pure does not include mood-based modifiers
- ranked-pure does not include ad-driven bonuses
- ranked-pure does not include external reward boosts

If a rewarded mode exists, it should use a clearly separate leaderboard or event namespace.

## Current Recommendation

For the current phase:

1. internal game + premium economy only
2. add ledger before shipping any value-bearing features
3. keep real-world rewards in policy and sandbox planning only
4. maintain strict separation from ranked-pure competition
