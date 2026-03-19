# Binary-2048 Chat And Emotion Governance

## Scope

This document defines the minimum policy for any future player chat, mood-aware assistance, or emotion-linked UX in Binary-2048.

It does not authorize shipping full player chat today. It defines the guardrails that must exist if those features move forward.

## Chat Moderation Baseline

If any player-generated messaging ships, the system must include:

- structured report flow
- abuse classification labels
- mute/block controls
- moderator review queue
- retention window with deletion behavior
- endpoint-specific rate limits

Minimum report categories:

- harassment
- spam
- impersonation
- cheating or collusion
- self-harm or safety concern
- illegal or explicit content

## Reporting Flow

Required product flow:

1. player reports message or sender
2. report captures context window, timestamp, user ids, and surface
3. content is hidden locally for reporter immediately
4. moderation record is created
5. review policy decides warn, mute, suspend, or close

Required engineering flow:

- immutable moderation event log
- audit trail for actions taken
- export/delete policy consistent with privacy commitments

## Retention Policy

If freeform messages are stored:

- default retention must be limited
- messages from deleted accounts must be tombstoned or purged per policy
- moderation evidence may be retained longer than user-visible content

Recommended defaults:

- standard message retention: 30 days
- moderation evidence retention: 90 days
- banned account evidence: case-dependent, reviewed manually

## Abuse Rate Limits

If chat is enabled, add dedicated limits separate from gameplay:

- guest chat disabled by default
- authed users: low per-minute and per-day send quotas
- paid users: slightly higher quotas, not unlimited
- burst limits on reports and messages
- CAPTCHA or challenge after suspicious velocity

## Consent Model For Mood Or Emotion Features

Emotion or mood-derived behavior must be opt-in.

Required rules:

- no hidden emotional inference
- no emotion-based personalization without explicit consent
- clear explanation of what signal is used and why
- separate consent from general Terms acceptance
- easy disable path in settings

Allowed initial consent scope:

- hint timing
- optional bot flavor reactions
- aggregated product analytics

## Ranked Integrity Rule

Emotion-linked gameplay or assistance must not affect ranked fairness.

Therefore:

- disable all emotion-triggered gameplay effects in ranked modes by default
- disable mood-adaptive hints in ranked
- disable chaos/reward triggers derived from emotion in ranked
- keep ranked evaluation based only on deterministic game state and explicit entitlements

## Non-Ranked Safe Uses

The following can be considered later in non-ranked or sandbox modes only:

- hint surfacing when a player appears stuck
- optional celebratory UX when delight signals are present
- bot flavor text that reacts to replay events

These must remain reversible, documented, and testable.

## Current Product Decision

For the current product phase:

- no freeform player chat
- no mood-based ranked gameplay changes
- any future emotion-linked UX must be optional, disclosed, and non-ranked
