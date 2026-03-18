# Binary-2048 Chat And Product Messaging Strategy

## Decision

Binary-2048 should not ship open player-to-player chat in the current product phase.

The recommended progression is:

1. No freeform player chat in live gameplay.
2. Lightweight product messaging only:
   - system notices
   - leaderboard season announcements
   - challenge copy
   - support/contact links
3. Optional bot-only reactions later, limited to flavor text and never affecting ranked outcomes.

## Why

Open chat adds operational cost before it adds clear value for this product.

Main risks:

- moderation burden
- abuse and harassment handling
- retention and privacy obligations
- bot spam and link abuse
- higher support load
- prompt-injection exposure if chat is ever routed into LLM features

Binary-2048 is currently strongest as:

- a deterministic puzzle game
- a bot-first competitive system
- a replay/share product

Chat does not materially improve those core loops yet.

## Allowed Messaging Surfaces

The product can safely support these messaging types now:

- app status and release notes
- feature announcements
- leaderboard/challenge notices
- issue-report and support links
- replay/share explanations
- opt-in subscription updates

These should remain one-way or tightly structured.

## Rejected For Current Phase

Do not ship these yet:

- global lobby chat
- direct messages
- match chat
- voice chat
- freeform comments on runs or leaderboards

## Later Safe Option

If social flavor is needed later, prefer bot-only reactions:

- short prewritten messages
- replay commentary generated from structured game events
- opt-in personality skins

Constraints:

- no freeform user input required
- no ranked integrity impact
- disableable in settings
- must respect accessibility and reduced-motion preferences if animated

## Entry Criteria For Any Future Chat

Revisit chat only after these are in place:

- stable moderation/reporting workflow
- retention and deletion policy
- abuse rate limiting
- block/mute model
- clear staffing/triage ownership
- privacy review for stored messages

## Current Recommendation

Keep Binary-2048 on product messaging plus issue reporting, and defer real chat until there is a clear community need that justifies the moderation and security cost.
