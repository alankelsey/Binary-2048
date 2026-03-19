# Binary-2048 Content And Community Operations

## Scope

This document defines the operating model for:

- LLM-generated blog production
- leaderboard and player spotlight content
- tile-of-the-week ideation and rollout
- analytics and operations dashboards
- community voting and issue triage

It is intentionally procedural. The goal is to make these systems safe, reviewable, and reversible before they are heavily automated.

## Blog Pipeline

### Cadence

- weekly lightweight post or roundup
- monthly deeper feature/interview/technical post

### Pipeline Stages

1. topic seed list
2. outline generation
3. draft generation
4. fact-check pass
5. editorial review
6. publish queue
7. post-publish link tracking

### Allowed Topic Packs

Use these topic groups:

- bots and AI strategy
- leaderboard interviews
- social/community stories
- technical architecture
- game culture
- math and probability
- science or systems-adjacent themes

### Editorial Guardrails

All posts must remain:

- politically neutral
- religiously neutral
- product-relevant or adjacent in a clear way
- non-defamatory
- fact-checked where claims are made

Reject any draft that:

- pushes political persuasion
- promotes religious argument
- makes unsupported claims about people
- recommends unsafe or illegal behavior

## Spotlight Formats

### Player Or Guest Bot Spotlight

Template:

- who the player/bot is
- favorite mode
- best run or favorite replay
- strategy note
- one short community-safe quote

Required moderation:

- consent before public spotlight
- remove identifying details unless explicitly approved
- no public shaming for low scores or failed runs

## Dashboards

### Game Analytics Dashboard

Recommended panels:

- active games
- runs per minute
- mode distribution
- difficulty distribution
- move rates
- replay exports
- replay link shares

### Leaderboard Ops Dashboard

Recommended panels:

- submission volume
- acceptance vs rejection counts
- rejection reasons
- sandbox vs live share
- ranked vs boosted submission split

These can start as internal operational views before full product UI.

## Tile Of The Week Program

### Workflow

1. idea proposal
2. mechanic constraints review
3. icon and copy draft
4. implementation draft
5. tests, replay compatibility, and balance checks
6. sandbox rollout
7. promote or reject
8. automatic expiry

### Feature Flag Requirements

Tile-of-the-week must support:

- start and end window
- explicit enable/disable toggle
- sandbox-only launch
- rollback without code revert

### Entitlement Policy

Default access:

- local dev: always configurable
- paid users: eligible if feature is promoted
- free users: optional depending on the experiment

Do not let weekly tiles leak into ranked-pure play without explicit design approval.

## Multi-Agent Tile Workflow

Minimum role flow:

1. proposer LLM
2. implementer agent
3. reviewer agent or human reviewer
4. merge gate

### Required Quality Gate

Before merge:

- tests pass
- lint/typecheck pass
- replay compatibility unchanged or intentionally versioned
- mechanic safety reviewed
- ranked eligibility decision recorded

## Community Voting

If community voting is enabled for tile ideas:

- submissions must be rate-limited
- voting window must be time-bounded
- duplicate or spam submissions must be suppressed
- moderator override must exist

### Winner Promotion

Winning ideas are not auto-shipped.

Required path:

- winner selected
- safety review
- implementation review
- sandbox validation
- promote or reject

## Governance And Rollback

Every experimental community-driven feature requires:

- manual override
- kill switch
- rollback plan
- explicit owner

This applies to:

- weekly tiles
- spotlight publishing
- experimental bot reactions
- community-voted content

## Bot Reactions And Personalities

Allowed use:

- monthly or event-based flavor content
- optional personality overlays
- sandbox or non-ranked presentation

Disallowed use:

- hidden competitive advantage
- ranked outcome influence
- moderation bypass

## Experimental Tile Review Board

Minimum board steps:

1. proposal intake
2. design review
3. implementation review
4. sandbox validation
5. promotion decision
6. rollback readiness confirmation

This can be lightweight at first, but it must exist.

## Issue Triage Convention

Use GitHub labels to split player signals cleanly:

- `bug`
- `idea`
- `balance`
- `content`
- `ops`
- `accessibility`
- `replay`
- `store`

Suggested workflow:

- player-reported bugs -> `bug`
- mechanic suggestions -> `idea` or `balance`
- blog/community/story items -> `content`
- infra/runbook issues -> `ops`

## Current Recommendation

Binary-2048 can safely proceed with content/community operations as a reviewed, semi-automated pipeline. Automation is acceptable for drafting and routing, but promotion, publication, and gameplay-affecting rollout must keep explicit human approval.
