# Tutorial Improvement Plan

Date: 2026-09-20
Status: implemented with automated coverage; visual re-review and real-device checks remain
Inputs:

- Product feedback from the 2026-09-20 tutorial review
- [`tutorial-design-plan.md`](./tutorial-design-plan.md)
- [`tutorial-frontend-review-2026-09-20.md`](./tutorial-frontend-review-2026-09-20.md)

This plan replaces the prototype's tall instruction panel and manual
`Next Lesson` flow. The engine-backed, deterministic lesson fixtures remain,
but the player experience becomes one continuous guided tutorial.

## Product Decisions

### One empty-state overlay

When no normal game or replay is active, show one empty-state overlay with
two immediately available actions:

1. `Start new game` — primary action.
2. `Play tutorial` — starts or restarts the guided tutorial.

Difficulty, mode, color, theme, tutorial-offer preference, and permitted
import/replay actions appear directly below those buttons. There is no
intermediate Options button or panel. Choosing New Game from an active, win,
or game-over state opens this same setup overlay without clearing the current
board; `Back` returns to that board or terminal overlay.

The empty-state overlay never hides Tutorial based on reminder state. If the
player chooses `Start new game` and has not suppressed the reminder, a compact
choice dialog offers `Play tutorial`, `Start game`, and `Back`. No current game
or recovery snapshot is cleared until the player chooses one of the first two
actions. The choice dialog includes the suppression checkbox.

### Reminder cookie

Use a dedicated, non-sensitive first-party cookie only for the persistent
`Don't show this again` choice:

```text
binary2048_tutorial_suppress=1
Path=/; Max-Age=31536000; SameSite=Lax; Secure (production)
```

- No cookie: show the tutorial invitation only after the player explicitly
  chooses New Game. Do not interrupt an active game merely to advertise the
  tutorial.
- Checking the opt-out sets the cookie immediately; unchecking it in the New
  Game choices removes the cookie. The choice remains effective in the current
  page and after reload.
- Cookie present: retain Tutorial buttons in the empty, active, win, and game
  over states, but let New Game proceed without the extra choice.
- Finishing or quitting the tutorial does not set the suppression cookie.
- Keep current-lesson resume state separate from this cookie. A versioned local
  progress value may restart the active lesson after refresh, but must be
  cleared on explicit quit or completion.

The cookie contains no identity, gameplay, analytics, or consent data and does
not need server-side storage.

Win and game-over overlays expose New Game and Tutorial. New Game opens the
inline setup choices; neither terminal overlay has an Options button. Starting
a tutorial from a terminal state needs no end-game confirmation. Starting it
from an active game remains confirmation-gated.

### Continuous guided flow

Remove `Next lesson` from the normal path. Each lesson/checkpoint follows this
sequence:

```text
coach overlay -> tap to try -> expected move -> success message -> next coach overlay
```

1. A compact coach overlay appears over the board without changing document
   height. It names the rule, shows the relevant special tile and its text
   label, and displays the required direction.
2. A brief arrow animation demonstrates the swipe direction. It runs once and
   ends in a static directional state; under `prefers-reduced-motion`, only the
   static arrow is shown.
3. The player taps `Try it` or the overlay itself to dismiss it and arm input.
4. Only the expected legal swipe, Arrow key, or WASD input changes the authored
   board. Incorrect input leaves the board unchanged and presents a concise
   direction hint.
5. On success, announce `Good job` plus the rule outcome in a live region for
   approximately 1700 ms, then automatically load the next checkpoint and
   open its coach overlay.
6. Multi-move rules such as Lock-0 use checkpoints inside one lesson: the first
   success explains the block, then the next coach overlay asks for the move
   that breaks it.
7. `Quit tutorial` remains available from every coach overlay and every armed
   board state. After progress, it uses the accessible confirmation dialog;
   quitting returns to the empty-state overlay and does not generate a board.

Automatic advancement must be cancellable when the component unmounts, the
player quits, a dialog opens, or the page becomes hidden. It must never apply a
move or start a normal game by itself.

### Board teaching cues

Extend each versioned fixture with presentation metadata:

- target cells or collision pairs;
- the expected direction;
- player-facing tile name and concise rule explanation;
- success message;
- optional sub-step/checkpoint identifier.

Before input is armed, show a quiet outline around the relevant cells and a
direction marker at the board edge. Do not dim the rest of the board. In
tutorial mode, wildcard tiles display `2×` and Lock-0 displays a readable
`Lock` label in addition to their normal accessible names.

### Mobile layout and game chrome

- Remove the flow-layout tutorial panel entirely; the board retains the space
  it has in normal play.
- Hide Score, High, Difficulty, Mode, normal export/replay controls, and other
  non-teaching game chrome during tutorial mode.
- Keep lesson progress compact, such as `3 of 10`, and expose the full lesson
  title to assistive technology.
- The coach overlay must fit at 360×640, 390×844, and 412×915 without causing
  the board to intersect the bottom action dock.
- Tutorial and dialog controls must be at least 44 px tall.
- Dev navigation and diagnostics remain development-only and must not affect
  production tutorial geometry.

### Completion

The final 1024 + 1024 move receives one restrained 2048 reveal using the
existing win visual language. Reduced-motion users receive the static 2048
tile, summary, and live announcement without movement.

The completion overlay recaps movement, zero, wildcard, and Lock-0, then
offers:

- `Start playing` — returns to the empty-state overlay with `Start new game`
  focused; it does not generate a board.
- `Replay tutorial` — restarts checkpoint one.

Completion does not suppress future invitations unless the player previously
selected `Don't show this again`.

## Accessibility Requirements

- Every overlay/dialog uses `aria-modal="true"`, has labelled/described
  content, moves focus inside on open, traps or inerts the background, and
  returns focus on its safe close path.
- Escape chooses the safe action. Arrow/WASD input cannot reach the tutorial
  state machine while an overlay or dialog is open.
- After a coach overlay closes, focus moves to the board/instruction target;
  keyboard input and touch input then share the same state-machine path.
- Instructions never rely only on the animated arrow, colour, glyph, or board
  position.
- Live announcements occur once per checkpoint; remove the prototype's
  duplicated instruction/feedback output.

## Implementation Phases

### Phase 1 — State and persistence improvements

- Separate reminder suppression, active tutorial progress, and completion.
- Add cookie read/write helpers and unit tests for absent, valid, stale-version,
  and malformed cookies.
- Change the tutorial state machine to `coach -> armed -> success -> coach`
  with cancellable automatic advancement.
- Represent Lock-0 as multiple checkpoints without exposing a manual Next
  button.

### Phase 2 — Empty state and options

- Replace the single-action New Game overlay contract with Start, Tutorial,
  inline setup choices, reminder preference, and an optional Back action.
- Render New Game choices inline and remove overlay Options buttons.
- Use `More` only for secondary actions during active mobile play; it is not a
  second settings editor.
- Preserve the active-game warning before Tutorial can end a normal run.

### Phase 3 — Coach overlay and teaching visuals

- Replace the tall panel with the board overlay and static fixture focus cues.
- Add the one-shot directional arrow and reduced-motion equivalent.
- Add visible labels for wildcard and Lock-0 in tutorial mode.
- Remove duplicate copy and tutorial-only game chrome.

### Phase 4 — Automatic progression and completion

- Add success timing, cleanup, live announcements, and next-checkpoint launch.
- Add the restrained 2048 reveal and completion actions.
- Preserve quit, refresh-current-lesson, and no-game-return behavior.

### Phase 5 — Accessibility and verification

- Add focus management, Escape, modal background inerting, and minimum target
  sizes to every new overlay/dialog.
- Run keyboard, touch/swipe, reduced-motion, axe/contrast, and background/resume
  checks.
- Perform Android Chrome and iPhone Safari checks before marking the roadmap
  parent complete.

## Automated Acceptance Matrix

Unit tests must cover:

- cookie serialization/parsing, versioning, expiration intent, and absence;
- reminder eligibility independent of completion/progress;
- continuous state transitions and cancellable auto-advance;
- deterministic board state for every checkpoint;
- fixture focus targets and special-tile labels;
- wrong input never mutating or advancing the board.

Playwright must cover:

- empty-state Start and Tutorial actions with inline Difficulty, Color, Theme,
  Mode, tutorial preference, and permitted Import/Replay choices;
- invitation shown every time the no-game overlay is entered without the
  cookie;
- leaving the checkbox unchecked prompting again after a normal run, tutorial
  quit/completion, reload, and a new browser context;
- checked `Don't show this again` setting the cookie and suppressing later
  invitations while leaving the Tutorial button available;
- no player-facing Options button or nested settings disclosure;
- active, win, and game-over New Game actions opening the same setup choices
  without clearing the current board before confirmation;
- tapping a coach overlay, then completing all checkpoints without any Next
  button;
- arrow direction for left/right/up/down and the reduced-motion static state;
- keyboard and real touch/swipe input through the same progression path;
- automatic success-to-next timing without double advancement;
- quit from intro, armed, success-delay, middle, and completion states;
- no board mutation while any modal overlay is open;
- focus entry/return, Escape, background inerting, and single live-region
  announcements;
- full board and dock non-overlap at 360×640, 390×844, and 412×915;
- tutorial hiding Score, High, Difficulty, Mode, export, and replay controls;
- final 2048 reveal with and without reduced motion;
- zero calls to gameplay persistence, leaderboard, export, tournament,
  simulation, or training routes.

## Completion Gate

Do not mark the tutorial roadmap item complete until all automated acceptance
checks pass, the frontend-review decision log is filled, accepted changes are
visually re-reviewed, and Android Chrome plus iPhone Safari checks pass.
