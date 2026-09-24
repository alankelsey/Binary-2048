# Tutorial Front-End Review — Recommendations for Implementation

Date: 2026-09-20
Reviewed: commit `554f171` ("add guided new-player tutorial")
Plan under review: `docs/tutorial-design-plan.md` (its "Design Review and Completion Gate" asks for this review)
Scope: **recommendations only — no code was changed.** This document is written to be handed to a separate implementation session.

## How this review was done (and its limits)

- Read the tutorial code (`lib/binary2048/tutorial.ts`, tutorial sections of `app/page.tsx`, `app/globals.css`) and the design plan.
- Ran the app locally (`npm run dev:once`) and drove the whole tutorial with headless Playwright Chromium at 1280×800, 390×844, 412×915 and 360×640, capturing every lesson plus the prompt, exit dialog and completion state. Key frames are in `docs/tutorial-review-2026-09-20/`.
- Measured element geometry, focus location and ARIA attributes with `page.evaluate`.
- **Not done:** real-device checks (Android Chrome, iPhone Safari), swipe-gesture testing, screen-reader testing (VoiceOver/TalkBack), `prefers-reduced-motion` testing, and colour-contrast measurement. Claude in Chrome was not connected during the review. Items that depend on these are marked **verify**.
- The dev-only chrome (DEV NAV, Game Log, "Dev Controls") shows in every screenshot. I did not confirm whether it is gated out of production builds. Treat the "noise" findings below as valid for dev and **verify** for prod.

## Summary

The mechanics are sound: the ten lessons run start to finish, wrong moves are rejected with a message, and the panel structure is readable. The problems are in presentation and in how the tutorial fits on a phone:

1. On phones the instruction panel and the board do not fit in one screen; at 360×640 the board is hidden behind the action dock.
2. The lessons do not visually point at anything, although the plan requires a highlighted row/column/tile.
3. Instruction text is shown twice on every lesson because of a data bug.
4. The dialogs do not manage focus or respond to Escape.
5. The completion moment, the one thing the plan calls "satisfying", has no emphasis.

Priorities: **P0** fix before real-device testing, **P1** should ship with the tutorial, **P2** polish.

---

## P0 — Fix first

### P0-1. Panel and board don't fit on a phone

Evidence (`mobile-390x844-lesson1.png`, `mobile-360x640-lesson1.png`):

| Viewport | Panel height | Board top → bottom | Dock top | Result |
|---|---|---|---|---|
| 390×844 | 225 px | 510 → 860 | 783 | Last board row is under the dock; bottom row of the board is not visible without scrolling |
| 412×915 | 225 px | 510 → 882 | 854 | Bottom row partly under the dock |
| 360×640 | 225 px | 577 → 897 | 579 | Board is entirely below the fold and under the dock; only the instructions are visible |

The lesson teaches swiping on the board, but the player cannot see the board and the instruction together. The plan requires the tutorial to "not cover the board" and to work in the mobile action-dock layout.

Recommendations:

- In tutorial mode on ≤560 px wide screens, replace the 225 px panel with a compact coach strip targeting ≤ 110 px: lesson title + one instruction line + a single row of actions. Move "Show Hint" behind a small icon/button that expands the hint inline only when asked.
- Remove things that add height but no teaching value in tutorial mode (see P1-6): the stats row (Score/Moves/High/Difficulty/Mode), the duplicated feedback line (P0-2), and the header/tagline where possible.
- Size against `100dvh`, not a fixed layout: the acceptance target is *instruction + full 4×4 board + dock visible at 360×640 with no scrolling*, and the same at 390×844 and 412×915. Add these three viewports to a Playwright assertion (board `boundingBox().bottom <= dock.top`).
- Alternative if the strip cannot be made small enough: pin the coach strip to the top of the viewport and let the board stay fixed under it, but do not let the dock overlap the board.
- The tutorial panel currently sits *above* the board; on mobile consider placing it *below* the board, so the thumb-reachable area is the board and the instruction is read once and then ignored. Try both in a device check.

### P0-2. Instruction text is duplicated on every lesson

Evidence: every lesson screenshot shows the instruction as regular text and then again in bold underneath.

Root cause: `createTutorialSession` initialises `feedback` from the lesson instruction (`lib/binary2048/tutorial.ts:194`), and the panel renders both `instruction` and `feedback` (`app/page.tsx` ~1504–1505). Lesson 1 also shows the hint text as a near-duplicate of the wrong-move feedback ("Try left. Move the 1 tile toward the left edge." followed by the hint "Move the 1 tile toward the left edge.").

Recommendations:

- Start `feedback` as an empty string; render the feedback line only when it has content (wrong move, "Good. Now move right", outcome). Keep it in a live region so screen readers still announce results.
- Remove the hint sentence from the wrong-move message (`Try ${expected}. ${lesson.hint}` at `tutorial.ts:205`); wrong-move feedback should say what to do once ("Try left."), and the hint stays behind the button.
- Rewrite hints so they add information the instruction lacks (which tile, why), and don't restate the instruction.
- Reserve the feedback line's space (min-height) or animate it in place so the panel doesn't jump when text appears; layout shift moves the board mid-lesson.

### P0-3. Dialog focus, Escape and modality

Evidence (measured): with the first-visit prompt open, `document.activeElement` is `BODY`; after "Start Tutorial" it is still `BODY` (the button that had focus unmounted). With the exit dialog open, focus stays on the panel's "Exit Tutorial" button *behind* the dialog; one Tab reaches the dialog. `aria-modal` is absent. Escape does nothing (the difficulty-help panel at `page.tsx:1364` already handles Escape, so there is precedent). The exit dialog overlays only the board (`.newgame-overlay`), so the panel's "Next Lesson", "Show Hint" and "Exit Tutorial" buttons remain visible and clickable while the dialog is open (`mobile-exit-dialog.png`).

The plan states: "Focus moves into each dialog and returns to the invoking Tutorial control when a launch confirmation is cancelled."

Recommendations:

- On open, move focus to the dialog's first action (or the dialog itself with `tabIndex={-1}`); on close, return focus to the trigger (`Tutorial` button, `Exit Tutorial` button) or, after "Start Tutorial", to the lesson heading (give the heading `tabIndex={-1}` and focus it on each lesson change so keyboard/SR users land on the new instruction).
- Add `aria-modal="true"`, `aria-describedby` pointing at the body copy, an Escape handler that maps to the safe choice ("Not now" / "Keep learning" / cancel), and either a focus trap or `inert` on the background (panel and board) while a dialog is open.
- **Verify:** whether arrow/WASD keys are swallowed while a dialog is open. My check was inconclusive because the lesson was already complete. Add a test: open exit dialog on an incomplete lesson, press the expected key, assert the board does not change.
- Rename the dialog confirm button. The trigger and the confirm are both "Exit Tutorial"; use "Leave tutorial" / "Keep going" (plain verbs, and the button that changes state says what it does).

---

## P1 — Teaching clarity and hierarchy

### P1-1. The board has no emphasis

`grep` for highlight/spotlight/target logic in `tutorial.ts` and the page returns nothing. Lesson 1 is one "1" tile on an otherwise empty 4×4 with no indication of where it should go. The plan requires "a highlighted relevant row, column, or tile without hiding the board".

Recommendations (one idea, kept quiet):

- Add an optional `focus` field to each lesson fixture (`cells: [row, col][]` plus optional `direction`). Render it as a static outline on the relevant tiles and a small direction chevron on the board edge the move heads toward. No pulsing by default; if a single attention pulse is used, play it once on lesson start and drop it under `prefers-reduced-motion` (the outline alone carries the meaning, per the plan's "reduced-motion behavior that does not depend on animation").
- For collision lessons (zero, wildcard, Lock-0, mixed), outline the pair that will collide, using the same outline treatment as the hint, so "what collides with what" is visible before the move rather than only explained after.
- Do not dim or blur the rest of the board.
- Add `focus` to the fixture type and unit tests so it is versioned with the lesson, as the plan requires for fixtures.

### P1-2. Special tiles aren't labelled where the lesson names them

Evidence (`desktop-wildcard-lesson.png`, `mobile-lock0-lesson.png`): lesson 6 says "the 2× wildcard", but the tile shows only a star glyph with no "2×". The Lock-0 tile is a tiny glyph in a small pink-outlined cell. A new player has no way to connect the words in the instruction to a tile on the board.

Recommendations:

- Show the actual tile inline in the instruction and hint text (a small tile sprite followed by its name), so "wildcard" is a picture *and* a word. Instructions must not rely on colour or symbols alone (plan, Accessibility section).
- Add a small caption below or on the tile itself for special tiles in tutorial mode (e.g. "2×" on the wildcard, "Lock" on Lock-0). Check that tile `aria-label`s already say the same words.
- Use the same names as the game guide throughout (plan requirement); audit the copy for "annihilator" (lesson 5 title, "Zero annihilator") versus the game guide's naming.

### P1-3. No way to retry or re-read a finished lesson

After a lesson completes, the board shows only the result. There is no undo in tutorial mode (by design), so a player who blinked cannot see what happened.

Recommendations:

- Add "Try again" (resets the current lesson to its authored start board, consistent with the plan's refresh policy) next to "Next lesson".
- Make the outcome line an explicit before → after statement, e.g. "8 + ✦ (2×) → 16", using the tile sprites from P1-2, rather than only prose. Make sure the outcome text is checked for each lesson; lesson 7 (Lock-0) is the hardest to follow because the result of move 1 (blocked) is not shown as its own state (`mobile-lock0-lesson.png` shows the lesson start, and the outcome line appears only after the second move).

### P1-4. Button hierarchy is flat

Every button in the panel is the same outlined pill (`Show Hint`, `Next Lesson`, `Finish Tutorial`, `Exit Tutorial`). "Next Lesson" and "Finish Tutorial" are the only forward actions and should read as primary.

Recommendations:

- Give the forward action a filled/primary treatment matching the game's existing primary button, and demote Hint and Exit to text/tertiary buttons. Put Exit at the far edge, away from the primary action.
- After a lesson completes, hide "Show Hint" (it has nothing left to hint at; it is still shown in `mobile-completion.png`), and autofocus "Next lesson". Accept Enter/Space or the expected swipe-free key to advance so keyboard players don't have to reach for the button.
- Rename: "Next Lesson" → "Next lesson", "Finish Tutorial" → "Start playing" (see P1-7), "Show Hint" → "Hint". Sentence case throughout, matching the rest of the guidance in the design skill (the game's existing buttons use Title Case, so match whichever the rest of the app uses and keep it consistent).

### P1-5. Progress is text-only and shouty

"STEP 1 OF 10" is a tracked, uppercase eyebrow (`.tutorial-progress`, `globals.css` ~1234–1240). It also duplicates the screen-reader status line at `page.tsx:1399–1400`.

Recommendations:

- Replace with a 10-segment progress bar that has three visible groups (Moves ×4, Special tiles ×4, Finish ×2) so the length feels bounded and the player knows there is a "special tiles" chapter coming. Segments must carry a text alternative ("Lesson 3 of 10: Move up").
- Sentence case for whatever text remains ("Lesson 3 of 10").
- Consider whether ten lessons is too many: lessons 1–4 are each a single move on an almost empty board. Merging left/right into one lesson and up/down into another (two tiles on the board, two moves) would cut about 30–40 s and reduce dropout risk. Product decision, not a design one; flagged for the owner.

### P1-6. Game chrome competes with the lesson

While in the tutorial, the header still shows `Game: Tutorial`, `Score`, `Moves`, `High`, `Difficulty: Death by AI`, `Mode: Classic`, `Tutorial`. Problems:

- "Death by AI" is an alarming and irrelevant label for someone learning the rules.
- "Game: Tutorial … Mode: Classic Tutorial" says the same thing three times.
- Score climbs during the tutorial (it reads **2048** at the end, `mobile-completion.png`) although the plan says the tutorial is not scored or ranked.
- On mobile these rows take about 70 px that the board needs (P0-1).

Recommendations: in tutorial mode replace the stats row with the lesson progress bar (P1-5), and hide Score/High/Difficulty/Mode. If a number is kept, show "Moves: n". Confirm that DEV NAV, Game Log and Dev Controls are hidden in production builds (**verify**); if they are not, hide them while the tutorial is active.

### P1-7. The completion moment is flat

Evidence (`mobile-completion.png`): the 2048 tile appears in the same place as any other tile, in red, with the same panel treatment and three summary bullets. This is the one moment the plan describes as "satisfying". Spend the design effort here and keep everything else quiet.

Recommendations:

- One orchestrated reveal when the 2048 tile forms: a single burst/glow on that tile (there is already a `.win-burst` style in `globals.css` that could be reused or adapted), gated by `prefers-reduced-motion` so reduced-motion users get the static tile plus the summary and live-region announcement.
- Make the summary recap the four rule groups the plan lists (movement, zero, wildcard, Lock-0), each with its tile sprite. The current three bullets fold movement and merging together and drop the names.
- Primary action "Start playing" (goes to the existing Start New Game overlay), secondary "Replay tutorial". "Finish Tutorial" describes the tutorial's state, not what happens next.

### P1-8. First-visit prompt

Evidence (`mobile-prompt.png`): a glowing, all-caps "LEARN TO PLAY" over an empty grid, with "Start Tutorial" and "Not Now" as equal-weight buttons; the dev Game Log sits below.

Recommendations:

- Make "Start tutorial" primary and "Not now" secondary/text.
- Say how long it takes ("10 short lessons" is fact; add a time estimate only after timing it) and that it can be reopened from the Tutorial button, which removes the fear of missing it.
- Sentence case title ("Learn to play"); drop the glow on this one dialog if the same glow style is used on the NEW GAME and GAME OVER overlays, so this prompt doesn't look like a game-state change.

---

## P2 — Polish and verification

- **Touch targets:** tutorial buttons measure about 32 px tall (`Show Hint`, `Exit Tutorial`, 89×32 and 99×32). The mobile dock is 61 px, so the tutorial controls are the smallest tap targets on the screen. Use ≥44 px height for tutorial and dialog buttons (48 px on Android per Material). This passes WCAG 2.2 AA minimum size (24 px) but is below the plan's "touch ergonomics" intent.
- **Live regions:** three `aria-live` elements are present on the page and there is a separate status line that repeats the step and feedback (`page.tsx:1399`). **Verify** with VoiceOver/TalkBack that each move is announced once, not twice, and that the feedback isn't re-read when the hint toggles.
- **Swipe versus scroll:** the board has `touch-action: none` (`globals.css:416`), so swiping on the board should not scroll the page. **Verify** on real iOS Safari, including a swipe that starts on the coach strip or on the empty area beside the board, since a page that has to be scrolled to see the board (P0-1) makes accidental scrolls likely.
- **Contrast:** colours in the panel (`#7dd3fc` on `rgba(10,31,54,.72)`, `#fff4b8` hint, `#dcfce7` summary) look high-contrast by eye. Not measured. Run an automated check (axe) in the Playwright suite.
- **Visual consistency:** the coach panel introduces three accent colours (sky-blue border, yellow hint bar, green summary) in addition to the tile palette. The yellow left-border-bar hint is a common template pattern; consider a single accent (the existing cyan) and distinguish hint/summary by icon and label instead of new hues.
- **Motion:** no animation exists on the tutorial UI today. Keep it that way except for the single completion reveal (P1-7) and, optionally, one attention cue on lesson start (P1-1).
- **Copy:** lesson titles mix styles ("Move left", "Zero annihilator", "Mixed special-tile practice"). Pick one voice; e.g. action-first titles ("Slide left", "Merge with a wildcard").
- **Hard-coded strings:** all lesson copy lives in `TUTORIAL_LESSONS`; that is fine for now but keep it together, since P1-2 adds inline tile references that will need a small markup convention (e.g. `{tile:wildcard}` tokens) rather than JSX in the data file.

---

## Suggested implementation order

1. P0-2 (copy duplication): one-line data fix, immediately shrinks the panel.
2. P0-1 (mobile fit) together with P1-6 (remove stats in tutorial mode), and add the three-viewport Playwright assertion.
3. P0-3 (dialog focus, Escape, `aria-modal`, inert background) plus tests.
4. P1-1 and P1-2 (board emphasis and tile labelling), which need fixture changes: `focus` field, unit tests for fixtures.
5. P1-4, P1-5, P1-3 (button hierarchy, progress bar, retry).
6. P1-7 and P1-8 (completion and prompt).
7. P2 items, then the real-device checks the plan requires.

## Tests to add or extend (`tests/ui/tutorial.browser.spec.ts`)

- At 360×640, 390×844 and 412×915: the coach strip and the whole board are within the viewport and the board does not intersect the dock.
- On first load of a lesson, the feedback line is empty and the instruction appears exactly once.
- Focus location: moves into each dialog on open; returns to the trigger on cancel; lands on the lesson heading after "Start tutorial" and after "Next lesson".
- Escape closes each dialog through its safe action; arrow keys do not change the board while a dialog is open.
- Buttons in the tutorial panel and dialogs are ≥44 px tall.
- Fixture unit test: every lesson has a `focus` target that is a cell containing a tile involved in the expected move.
- Tutorial mode hides Score/Difficulty/Mode, and score does not accumulate.

## Decision log (per the plan's "accepted / modified / declined")

| ID | Recommendation | Decision | Reason |
|---|---|---|---|
| P0-1 | Compact coach strip; board + instruction visible on 360×640 | Modified | Replace the flow-layout panel with a compact coach overlay over the board so it cannot push the board under the dock. |
| P0-2 | Remove duplicated instruction/feedback/hint text | Accepted | Instructions render once; feedback is empty until an input result and is announced once. |
| P0-3 | Dialog focus, Escape, `aria-modal`, inert background | Accepted | Required for every empty-state, coach, quit, and completion overlay. |
| P1-1 | Board highlight + direction chevron via fixture `focus` | Accepted | Add fixture focus targets plus the requested one-shot directional swipe arrow; retain a static cue for reduced motion. |
| P1-2 | Inline tile sprites/labels for special tiles | Accepted | Coach copy and tutorial tiles will pair glyphs with player-facing text labels. |
| P1-3 | "Try again" + before → after outcome | Modified | Outcomes appear in the automatic success message. Continuous auto-advance replaces the finished-lesson button row; replay remains available at completion. |
| P1-4 | Primary/tertiary button hierarchy | Modified | Start/try/play actions are primary; quit and reminder suppression are secondary. Settings are inline on New Game, and active mobile secondary actions use `More`. |
| P1-5 | Segmented progress; consider merging lessons 1–4 | Modified | Keep all ten authored lessons for explicit rule coverage, use compact grouped progress, and remove manual Next actions. |
| P1-6 | Strip game chrome in tutorial mode | Accepted | Hide Score, High, Difficulty, Mode, export, replay, and other non-teaching controls. |
| P1-7 | Single completion reveal; recap four rule groups | Accepted | Add one reduced-motion-safe 2048 reveal, `Start playing`, and `Replay tutorial`. |
| P1-8 | Prompt hierarchy and copy | Modified | Keep Start and Tutorial prominent, place game choices inline below them, and ask whether to launch the tutorial only after New Game when the cookie preference has not suppressed the offer. |
| P2 | Touch targets, live regions, swipe, contrast, accents | Accepted | Add automated checks where possible and retain real-device/screen-reader verification as the completion gate. |

## Evidence files

All in `docs/tutorial-review-2026-09-20/`:

- `mobile-prompt.png` — first-visit prompt at 390 px
- `mobile-390x844-lesson1.png`, `mobile-360x640-lesson1.png` — viewport-only captures showing board/dock overlap
- `mobile-lock0-lesson.png` — Lock-0 tile size and duplicated copy
- `mobile-exit-dialog.png` — exit dialog with panel buttons still live behind it
- `mobile-completion.png` — final state: score 2048, summary, unstyled 2048 tile
- `desktop-wildcard-lesson.png`, `desktop-mixed-practice.png` — special tiles without labels
