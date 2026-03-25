# Binary-2048 UX Audit Playbook

## Purpose

This playbook defines how we audit Binary-2048 UX before and after changes.

The goal is to catch:

- accidental taps on mobile controls
- control placement conflicts with swipe play
- session-loss or resume problems
- confusing auth, replay, or store flows
- friction that shows up only on small screens or interrupted sessions

## Audit Types

### 1. Heuristic Audit

Run a structured product review against the current build.

Focus areas:

- first-run clarity
- control discoverability
- accidental destructive actions
- replay/share comprehension
- session continuity
- accessibility and reduced-motion behavior

This is the fastest and cheapest audit type. It should happen on every major UX batch.

### 2. Task-Based Usability Audit

Give a player or tester a short set of tasks:

- start a new game
- play 10 moves on mobile
- undo once
- export replay
- copy replay link
- background the phone, lock it, and resume later

Observe:

- where they hesitate
- what they tap by mistake
- whether they understand what happened
- whether the game state survives interruption

### 3. Telemetry Audit

Use event data to identify friction that players will not always report.

Track:

- accidental `new_game` taps immediately after active play
- undo open vs use rate
- bottom-control taps during active swipe sessions
- session resume rate
- session loss after background/resume
- replay/share failures

### 4. Production Session Replay Or Visual Capture

For UX-only analysis, use privacy-safe screen capture or session replay tooling with consent.

Potential tools:

- Microsoft Clarity
- PostHog session replay
- LogRocket
- FullStory

Use only if:

- privacy disclosure is clear
- sensitive inputs are masked
- replay retention is bounded

For Binary-2048, Clarity or PostHog are the best low-friction first options.

## Recommended Tool Stack

### Lightweight Feedback + Behavior

- **GitHub issue templates**
  - already good for structured bug/idea intake
- **Microsoft Clarity**
  - free and strong for heatmaps, dead clicks, rage clicks, mobile frustration
- **PostHog**
  - better if we want product analytics and feature-flag experiments in one place

### Direct Usability Feedback

- small tester panel via friends/dev community
- Google Form or Typeform for short post-test survey
- in-app `Report Issue` link with contextual prefill

### Mobile-Specific Audit Tools

- Chrome remote debugging on Android
- Safari Web Inspector on iPhone
- Playwright mobile viewport checks
- real-device manual testing for:
  - thumb reach
  - accidental button taps
  - resume after lockscreen/background
  - browser tab restore behavior

## Binary-2048-Specific UX Risks

### Bottom Control Mis-Taps

Current concern:

- On mobile, `New Game`, `Undo`, and replay controls sit close to the swipe zone.

Audit checks:

- thumb path overlaps action buttons
- controls remain visible when active play should be primary
- destructive actions are too easy to trigger

Likely improvements to test:

- move controls into a collapsible options drawer during active play
- separate destructive actions from the swipe zone
- require confirmation for `New Game` when a live run exists
- add larger spacing from the board edge

### Interrupted Session Resume

Current concern:

- when the phone goes to the lockscreen and Chrome resumes later, a new game may start instead of restoring the active game

Audit checks:

- app restore path on tab freeze/unfreeze
- local persisted session id still exists
- production session backend returns prior state on resume
- no eager `newGame()` on hydration if a saved session exists

This is not just UX. It is also a persistence/resume correctness issue.

## Suggested Audit Cadence

### Before Release

- one heuristic pass
- one mobile real-device pass
- one interrupted-session pass
- one analytics sanity review

### After Release

- weekly review of:
  - accidental destructive actions
  - replay/share failures
  - session resume failures
  - mobile rage/dead click patterns

## Success Metrics

Good UX changes should reduce:

- accidental `New Game` activations
- support complaints about lost games
- failed replay/share attempts
- time-to-first-confident-play

Good UX changes should increase:

- resumed-session success rate
- replay/share success rate
- session depth on mobile

## Proposed Near-Term Binary-2048 UX Audit

1. Run a dedicated mobile audit on iPhone + Android.
2. Record thumb-reach conflicts for bottom controls.
3. Add telemetry for accidental destructive taps.
4. Reproduce and isolate the mobile lockscreen/resume reset bug.
5. Move risky controls behind a drawer or safer layout during active play.
6. Re-test after the control layout change.
