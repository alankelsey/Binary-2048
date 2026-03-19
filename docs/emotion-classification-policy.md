# Binary-2048 Emotion Classification Policy

## Decision

Binary-2048 may evaluate emotion-classification tooling only for non-ranked assistance, analytics, and bot flavor systems.

It must not use emotional inference to alter ranked balance, payouts, or punitive gameplay.

## Candidate Stack

The current reference candidate is a compact classifier such as `roberta-base-go_emotions`, evaluated as an offline or server-side inference component.

Evaluation criteria:

- precision and recall on short game-adjacent text
- latency acceptable for support or hint timing
- privacy cost of storing inputs or outputs
- explainability for support and compliance review
- resilience to slang, sarcasm, and adversarial phrasing

## Allowed Use Cases

Allowed use cases are limited to:

- aggregated sentiment analytics
- support triage assistance
- optional hint timing when a player appears confused or stuck
- optional UX adaptation in non-ranked modes
- bot personality or flavor responses

These uses must be disclosed, opt-in where applicable, and never mandatory for core play.

## Disallowed Use Cases

The following are rejected:

- covert manipulation of player behavior
- ranked balance changes driven by emotional inference
- punitive emotional targeting
- reward boosts tied to inferred mood
- chaos penalties tied to inferred mood
- secret player segmentation based on emotional vulnerability

## Dashboard Rule

Any mood analytics dashboard must be aggregated only.

Do not expose per-user emotional labels to operators unless there is an explicit support or moderation workflow with documented need and access control.

## Hint-Assist Rule

Hint timing experiments are allowed only in:

- non-ranked modes
- explicit opt-in surfaces
- measurable experiments with rollback

Hints must not:

- consume paid value automatically
- alter score submission eligibility silently
- be enabled in ranked modes

## Bot Personality Rule

Bots may simulate emotional tone as flavor text without storing sensitive user emotion state by default.

Examples:

- celebratory post-replay commentary
- calm coaching tone
- playful rivalry messaging in sandbox modes

These systems should be driven from game events first, not inferred player psychology.

## Event Trigger Policy

If Binary-2048 ever links emotion-like signals to events, permitted triggers are limited to low-stakes UX:

- `confusion -> hint availability`
- `joy -> cosmetic flourish`
- `frustration -> offer replay/postmortem tools`

The following remain prohibited:

- `anger -> chaos tile`
- `joy -> ranked multiplier`
- `confusion -> hidden handicap`

## Evaluation Set Requirements

Before shipping any emotion classifier, build an evaluation set that includes:

- normal support questions
- frustrated bug reports
- sarcasm and joking language
- abusive content
- empty/ambiguous short messages
- false-positive edge cases

Track:

- false positives
- false negatives
- disagreement rate across annotators
- performance drift over time

## Privacy Requirements

Emotion inference must follow stricter privacy handling than ordinary gameplay telemetry.

Minimum rules:

- avoid retaining raw text unless necessary
- separate consent for inference-based personalization
- support export/delete handling for stored emotional metadata
- document retention windows
- disclose purpose in user-facing privacy docs

## Current Product Position

Binary-2048 should not ship emotion classification into core gameplay now.

The correct near-term path is:

1. keep it in evaluation and docs
2. allow only low-stakes non-ranked experiments later
3. require opt-in, privacy review, and clear kill switches before any production rollout
