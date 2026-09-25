# Tutorial and Mobile Acceptance Gate

Date: 2026-09-24

Status: automated and deployed-browser review complete; physical Android Chrome
and iPhone Safari acceptance is intentionally deferred to the final V1 gate

## Evidence and limits

- Reviewed the deployed guest flow at `https://www.binary2048.com` in headless
  Chromium and reran the production-safe browser suite.
- Reran the complete local UI suite against the V1 implementation at 360x640,
  390x844, and 412x915 where applicable.
- Reran the complete unit suite and a production build/type check.
- Headless viewport and synthetic touch checks do not prove physical-device
  safe areas, dynamic browser chrome, touch latency, browser suspension, or
  TalkBack/VoiceOver behavior. The two roadmap parents therefore remain open.
- The current Playwright lane uses Chromium. A supplemental iPhone/WebKit lane
  is planned; its browser binary is not installed in this workspace. Full
  Mobile Safari simulation additionally requires Xcode and an iOS Simulator
  runtime, which are also absent. Emulation results will be recorded separately
  and will not close either physical-device parent.

## Frontend-review follow-up disposition

| Finding | Disposition after re-review | Evidence / remaining work |
|---|---|---|
| P0-1 mobile fit | Modified, accepted | Compact coach overlay and stripped tutorial chrome keep the board and coach inside all three automated mobile viewports. Physical browser chrome and safe-area behavior still need verification. |
| P0-2 duplicated copy | Accepted | Instructions render separately from initially empty feedback; wrong-direction feedback is concise. Full tutorial automation passed. |
| P0-3 dialog modality | Accepted, modified in this pass | Existing `aria-modal`, Escape, and initial focus behavior were retained. This pass added tab containment and focus return to the invoking Tutorial/Quit control, with regression coverage. |
| P1-1 board emphasis | Accepted | Authored focus cells and directional cues render for each lesson; reduced-motion automation confirms the cue remains static. |
| P1-2 special-tile labels | Accepted | Wildcard `2x` and Lock labels plus accessible tile names are present in the guided flow. |
| P1-3 retry / outcome | Modified | Automatic success feedback and progression remain in place instead of a manual retry row. This pass fixed progression so its delay pauses while the page is hidden and resumes safely. |
| P1-4 action hierarchy | Modified | Primary Try/Start actions, secondary quit actions, inline New Game choices, and the mobile `More` disclosure match the approved flow. |
| P1-5 progress | Modified | Ten authored lessons remain, with compact lesson progress and automatic advancement. |
| P1-6 tutorial chrome | Accepted | Gameplay score, difficulty, mode, export, and replay controls are absent during the tutorial. |
| P1-7 completion emphasis | Accepted | The 2048 reveal, four-rule recap, Start playing, and Replay tutorial are present. Physical reduced-motion presentation still needs observation. |
| P1-8 first-use prompt | Modified | The offer follows an explicit New Game action, choices remain inline, and cookie-backed suppression is covered by automation. |
| P2 touch, live regions, swipe, contrast, accents | Needs real-device verification | Automated target-size, synthetic swipe, viewport, keyboard, and reduced-motion checks pass. Actual finger input, browser scrolling, safe areas, and TalkBack/VoiceOver remain manual. |

## Confirmed V1 defects fixed locally

1. Tutorial success auto-advance previously continued while the document was
   hidden. It now preserves the remaining delay while hidden and resumes on
   visibility, preventing a backgrounded device from skipping a lesson.
2. Tutorial confirmation dialogs declared modality but did not contain keyboard
   focus or return it to the invoking control. Focus now stays within the
   topmost modal and returns after cancellation.

Both fixes have Playwright regression coverage and were deployed in the
accepted tutorial/mobile review release.

## Automated results

- Unit: `149/149` suites and `481/481` tests passed.
- Local Playwright UI: `50` passed / `1` debug-flag case skipped.
- Production-safe Playwright: `9/9` passed.
- Focused production Game Over check: `1/1` passed and explicitly confirmed
  the deployed `Replay JSON` action.
- Typecheck passed. The production browser auth/API health checks passed.
- Terminal-overlay regression coverage verifies that keyboard activation of
  `Replay JSON` imports a valid replay, enters replay mode, and restores the
  game-over or win overlay after replay exit.

## Physical-device checklist

### Android Chrome

- Open the deployed site in portrait with normal browser chrome. Confirm the New
  Game overlay shows Difficulty, Color, Theme, Mode, tutorial preference, and
  permitted Import/Replay actions, with no Options button.
- With no suppression cookie, start New Game, verify the tutorial offer, toggle
  "Don't offer", reload, and verify both persistence and permanent Tutorial
  access.
- Complete all ten lessons using real finger swipes in all four directions.
  Check the number, zero, wildcard, and Lock-0 cues/labels, wrong-swipe rejection,
  success timing, quit flow, completion recap, and return to New Game.
- During an active run, cancel New Game and Tutorial launch and confirm the exact
  board and turn remain. Open/close `More`; confirm reachable targets, one-row
  dock layout, and no board/final-content overlap.
- Reach both Game Over and You Win, activate `Replay JSON`, select a valid JSON
  file from the Android picker, and confirm replay mode opens and exits cleanly.
- Send a rapid swipe burst and confirm moves stay ordered with no silent drops or
  errors.
- Background/lock during an active game and during tutorial success feedback;
  return and confirm the same game/turn or lesson remains with no reset, skip, or
  double advancement.
- With TalkBack, confirm modal focus stays contained and lesson/result messages
  are announced once.

### iPhone Safari

- Repeat the critical New Game offer, tutorial launch, all-direction swipe,
  quit/completion, active-game cancellation, `More`, and both terminal-overlay
  `Replay JSON` file-picker checks.
- Expand/collapse Safari's address bar and check portrait notch/home-indicator
  safe areas: coach, full board, primary dock, and final content must remain
  visible without overlap.
- Verify a board swipe moves tiles without page bounce/scroll; swipes beginning
  on the coach or beside the board must not cause an accidental game move.
- Background/lock Safari and return to confirm game and tutorial continuity.
- With VoiceOver, confirm modal focus containment and single announcements.
