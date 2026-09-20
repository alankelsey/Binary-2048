# Guided Tutorial Design Plan

Status: functional prototype implemented; expanded acceptance coverage, design review, and real-device checks remain

This document defines the product behavior and acceptance criteria for the
Binary-2048 new-player tutorial. The tutorial is an authored teaching mode,
not a ranked or resumable game.

## Goals

- Offer new players a tutorial before their first game without forcing them
  into it.
- Keep the tutorial available at any time after the first prompt.
- Teach every movement direction and every currently supported tile type.
- Show each rule through a controlled interaction, not only explanatory text.
- Finish with a short, satisfying merge chain that creates a `2048` tile.
- Return the player to an unambiguous new-game state after leaving tutorial
  mode.

## Entry and Exit Behavior

### First-visit prompt

When no completed/dismissed tutorial preference and no recoverable game exist,
show a tutorial prompt before creating a board. It offers:

- `Start Tutorial`: enters step 1.
- `Not Now`: dismisses the prompt and returns to the existing explicit
  `Start New Game` state.

Dismissal and completion are stored locally so ordinary refreshes do not show
the prompt repeatedly. A durable `Tutorial` action remains available in the
game controls/help area. Account-level synchronization may be considered
later, but is not required for the first implementation.

### Launching at any time

- With no active game, `Tutorial` launches immediately.
- With an active game, it opens a destructive-action confirmation explaining
  that the current run will end.
- Cancelling that confirmation leaves the game completely unchanged.
- Confirming clears the active game and its resumable snapshot before entering
  tutorial mode. Tutorial activity must not be submitted to leaderboards,
  persisted as a normal run, or mixed into gameplay/training datasets.

### Leaving tutorial mode

A visible `Exit Tutorial` action is available on every step. Exiting requires
confirmation only after the player has made tutorial progress; it must never
trap the player. Cancellation and successful completion both:

1. clear tutorial-only board and progress state;
2. return to the no-active-game screen;
3. show the existing `Start New Game` overlay;
4. avoid automatically generating a normal game board.

The browser back button, refresh, and background/resume behavior must not turn
a tutorial board into a normal game. Refresh or resume restarts the current
lesson from that lesson's authored initial board, preserving the lesson number
but never a partially moved tutorial board. This behavior is deterministic and
must be covered by tests.

## Tutorial Interaction Model

Use deterministic, authored lesson boards. Disable ordinary random spawning,
undo, replay export, leaderboard submission, competitive modes, paid boosts,
and game-over logic while tutorial mode is active. Only the expected legal
move advances a lesson; other input should provide a short hint and leave the
board unchanged.

Each step includes:

- a concise instruction naming the intended direction or interaction;
- a highlighted relevant row, column, or tile without hiding the board;
- swipe, Arrow, and WASD support through the normal input mapping;
- a visible progress indicator such as `Step 3 of 10` plus a named lesson;
- an optional `Show Hint` action;
- screen-reader status text announcing the instruction, move result, tile
  interaction, and progress;
- reduced-motion behavior that does not depend on animation to communicate a
  result.

The UI must work in the mobile action-dock layout and must not place tutorial
controls over the board or system safe areas.

## Authored Lesson Sequence

Exact board coordinates can be refined during implementation, but every lesson
must have a versioned fixture and deterministic expected state.

1. **Move left** — slide ordinary number tiles left and explain that every tile
   moves together until blocked.
2. **Move right** — repeat in the opposite direction and demonstrate a basic
   equal-number merge.
3. **Move up** — teach vertical movement with a simple column.
4. **Move down** — complete coverage of all four input directions.
5. **Zero tile** — move a number into `0` and demonstrate annihilation,
   including a concise explanation that `0 + 0` also vanishes.
6. **Wildcard tile** — merge a wildcard with a number and show the resulting
   multiplier/doubling behavior.
7. **Lock-0 tile** — demonstrate its blocked collision turn, then the later
   interaction where it behaves as `0`.
8. **Mixed special-tile practice** — solve a small authored board containing
   ordinary and special tiles, reinforcing movement order and consequences.
9. **Build toward 2048** — use a staged high-value board to perform the first
   merge in the final chain.
10. **Create 2048** — make the last guided move, visibly create `2048`, and show
    a completion summary recapping movement, zero, wildcard, and Lock-0 rules.

The final implementation may split a complex rule into an additional step, but
completion is allowed only after the player has successfully exercised all
four directions and every tile type, followed by creation of `2048`.

## State and Data Boundaries

Represent tutorial mode separately from `GameSession`, with a small state
machine such as:

```text
not-offered -> offered -> active(step) -> completed
                  |           |
               dismissed   cancelled
```

Record only the minimum local preference needed for prompt behavior and
progress, for example a versioned tutorial status and current lesson. Do not
reuse a production game ID. If tutorial analytics are added, use explicit
events such as `tutorial_prompted`, `tutorial_started`, `tutorial_step`,
`tutorial_cancelled`, and `tutorial_completed`; never count tutorial moves as
normal gameplay moves or model-training examples.

Version lesson fixtures and completion state so future rule changes can offer
an updated tutorial without corrupting old progress.

## Accessibility and Content Requirements

- The prompt, confirmation, hints, progress, completion, and exit controls must
  be fully keyboard and touch accessible.
- Focus moves into each dialog and returns to the invoking `Tutorial` control
  when a launch confirmation is cancelled.
- Instructions must not rely on color, position, animation, or symbols alone.
- Special tiles use their player-facing names consistently with the game guide.
- Copy should explain one rule at a time and remain readable at 390px and 412px
  widths without covering the board.
- Reduced-motion mode uses static state changes and live-region announcements.

## Automated Acceptance Coverage

Unit tests must cover the tutorial state machine, fixture determinism, expected
move validation, progress/completion rules, preference versioning, and the
separation between tutorial and normal game state.

Playwright coverage must verify:

- first-visit prompt and `Not Now` persistence;
- starting from the no-game state;
- the persistent launcher after dismissal and completion;
- active-game warning, cancelled launch preserving the exact game, and
  confirmed launch removing the active/resumable run;
- all four move directions through keyboard and touch/swipe input;
- zero, wildcard, Lock-0, ordinary merge, mixed practice, and final `2048`
  lesson outcomes;
- incorrect moves do not mutate or advance the lesson;
- exit from early, middle, and final steps returns to `Start New Game`;
- refresh/background behavior follows the documented deterministic policy;
- no tutorial calls reach ranked submission, normal game export, or training
  ingestion routes;
- mobile layout, focus order, live-region announcements, and reduced motion.

## Design Review and Completion Gate

Build the functional, accessible prototype and automated coverage first. Then
provide the frontend-design reviewer with this plan, representative desktop and
mobile screenshots, and the implemented prompt, active-game confirmation,
lesson, hint, exit, and completion states.

The reviewer should evaluate hierarchy, instruction clarity, board emphasis,
progress visibility, touch ergonomics, motion, and visual consistency. Record
each recommendation as accepted, modified, or declined with a reason. Apply
accepted changes and rerun the automated suite. The roadmap item is complete
only after final real-device checks on Android Chrome and iPhone Safari.
