# Binary-2048 UX Session Replay Tooling Decision

## Goal

Choose a lightweight way to observe real player friction after mobile UX changes without over-collecting data or adding a heavy analytics stack too early.

The immediate use cases are:

- verify whether the mobile controls tray reduced accidental taps
- verify whether resume recovery reduced silent resets
- inspect rage taps and dead clicks around action controls
- support short-term launch diagnostics without building a large custom replay dashboard first

## Candidates

### Microsoft Clarity

Pros:

- fast to adopt
- strong heatmaps and session replay for web UX issues
- good fit for spotting rage clicks, dead clicks, scroll friction, and mobile mis-taps
- low setup overhead

Cons:

- less product-analytics depth than PostHog
- weaker event/funnel workflow compared to a product analytics platform
- should still be paired with explicit app-side event instrumentation for game-specific context

### PostHog

Pros:

- combines event analytics, funneling, flags, and session replay
- can correlate replay sessions with our existing in-app UX events
- stronger long-term fit if Binary-2048 grows into a richer product dashboard

Cons:

- more setup and maintenance overhead
- easier to over-instrument too early
- more schema discipline needed to keep event quality high

## Decision

Use **Microsoft Clarity first** for the first production UX audit phase.

Rationale:

- We already ship lightweight in-app events for resume outcomes and control-friction telemetry.
- The main unanswered questions are visual and interaction-oriented, not funnel-modeling gaps.
- Clarity is the faster way to learn whether mobile changes improved real behavior.

Keep **PostHog** as the later upgrade path if we need:

- feature flags or experiments
- richer product funnels
- retention analysis
- merged replay + event analytics under one tool

## Privacy Constraints

Before enabling any replay tool:

- scrub game export payloads, tokens, and auth headers from capture paths
- avoid sending replay JSON, session proofs, admin tokens, or signed auth material
- document retention limits and delete policy
- keep capture focused on UX diagnostics, not surveillance

Recommended first-pass limits:

- enable only on production and staging, not local dev
- short retention window
- explicit exclusion of auth and admin surfaces if possible
- sample rate lower than 100% once launch diagnostics stabilize

## Rollout Plan

1. Keep the current in-app telemetry as the source of game-specific signals.
2. Add Clarity behind a simple environment flag.
3. Verify sensitive routes and fields are excluded or masked.
4. Review a handful of mobile sessions after release.
5. Reassess whether PostHog is warranted after the first UX audit cycle.

## Recommendation Summary

- **Now:** Microsoft Clarity
- **Later if needed:** PostHog
- **Always:** pair third-party replay with explicit in-app events for game-specific interpretation
