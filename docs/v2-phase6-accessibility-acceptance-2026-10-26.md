# V2 Phase 6 animation accessibility acceptance

<!-- cspell:ignore localabstract viewports -->

Date: 2026-10-26 America/Boise

Status: automated checks, reduced motion, physical Pixel safe-area geometry,
and physical background/resume passed. Manual TalkBack spoken-announcement
behavior remains pending, so the parent Phase 6 checklist item stays open.

## Scope and limits

This acceptance follows the special-tile effect optimization at `09ca5ed` and
the deployed evidence commit `196b628`. The CSS change affected only transient
visual properties; it did not change board roles, cell names, live regions,
focus order, or controls. Even so, the post-change check covers those semantics
alongside motion and lifecycle behavior.

Chrome's accessibility tree can prove roles, names, and live-region exposure.
It cannot prove what TalkBack speaks, whether an announcement is duplicated,
or whether a user can comfortably traverse the interface. Those claims remain
reserved for a human TalkBack pass.

## Checked-in Pixel harness

`scripts/v2-phase6-pixel-accessibility.mjs` attaches to one visible production
tab through the existing privacy-safe CDP path. It records only public target
context, bounded DOM geometry, computed safe-area padding, and aggregate counts
of expected accessibility roles. It rejects hidden or landscape tabs, an
unexpected footer commit, board/dock overlap, a dock outside the visual
viewport, anything other than 16 named grid cells, and accessibility-tree
counts that disagree with visible controls.

It does not retain the raw accessibility tree, text outside the expected role
checks, identity, cookies, tokens, storage, IP, SSID, screenshots, HARs, or raw
traces.

Run with:

```sh
adb forward tcp:9222 localabstract:chrome_devtools_remote
BINARY2048_EXPECT_COMMIT=196b628 npm run ops:v2:pixel-accessibility
```

## Automated results

- Focused unit suites: 2 suites, 11 tests passed. These cover safe-area/dock
  CSS and transient-effect reduced-motion rules.
- Focused mobile/browser suites: 34 tests passed. These cover dock non-overlap,
  mobile viewports, reduced-motion and standard-motion durations, touch/swipe,
  tutorial behavior, keyboard behavior, and live-region semantics.
- Production browser acceptance: 9 tests passed. This includes the core shell,
  special tiles, a complete guest lifecycle, ordered rapid input across
  recovery, stale-session recovery, game-over flow, and auth health.

The first production run exposed two obsolete recovery fixtures. The deployed
client retries a missing instance-local session with `compactRecovery`, while
the tests accepted only legacy `recoverySnapshot` and expected one request per
recovered move. The fixtures now accept the checkpoint-tail contract, flush
the intentionally deferred local write before simulating resume, include the
required config/hash fields, and assert the initial 404 plus recovered retry.
No runtime source changed.

## Reduced-motion result

With Android Remove animations enabled, Chrome reported
`prefers-reduced-motion: reduce`. Number merge, wild merge, zero bust, and
spawn each computed to a 0.001-second animation in the final four-second
production check. Remove animations was restored to off afterward. Both the
focused CSS tests and mobile browser suite independently passed the same
contract.

## Physical Pixel geometry

Target: `https://www.binary2048.com/`, deployed commit `196b628`, Pixel 10 Pro
XL, Android 17, Chrome 156, portrait on Wi-Fi, guest state.

- Visual viewport: 443.08 by 827.90 CSS pixels.
- Board: left 20.01, right 423.06, top 65.88, bottom 468.93.
- Fixed primary dock: left 0, right 443.08, top 766.18, bottom 827.90.
- Main bottom padding: 79.30 px; dock bottom padding: 8.90 px.
- The dock was inside the visual viewport and did not overlap the board.
- Chrome exposed one `grid` named `Binary 2048 game board`, all 16 grid cells
  with row/column names, and four live regions. Direction buttons were disabled
  in the tested game configuration, so none were expected or exposed.

The geometry establishes Android Chrome behavior on this target Pixel. It does
not substitute for iPhone Safari safe-area acceptance.

## Physical background/resume

One physical left-arrow input advanced the visible production game from move 0
to move 1. Chrome was sent to the Android home screen for five seconds and its
existing task was then brought to the foreground. The same production tab
returned active at move 1 with one completed input, zero dropped inputs, no
busy state, no rollback, and no duplicate move.

## Remaining gate

TalkBack 17.1 is installed on the target Pixel and was confirmed disabled
before testing. Complete a short human pass with TalkBack enabled:

1. Traverse the game heading, status, 16-cell board, New Game, and More
   controls in a sensible order.
2. Confirm every cell announces its row, column, and value or empty state.
3. Enable direction buttons in the new-game choices and confirm all four have
   distinct names and activate once.
4. Make a merge and a no-op move; confirm game status feedback is useful and
   not announced twice.
5. Background and resume Chrome; confirm focus returns predictably and the
   current game status is not repeated excessively.

After that physical speech/interaction pass, record the result and close the
parent Phase 6 accessibility item. VoiceOver and iPhone safe-area behavior
remain separate roadmap gates and must not be inferred from this Pixel result.

## Continuation checkpoint

Checkpoint commit `19dac14` was pushed to `main`, deployed successfully by
Amplify job 446 for the exact full SHA, and passed the production smoke on the
first attempt. The Pixel footer then reported `19dac14`. The checked-in Pixel
accessibility harness was rerun against that deployment and again passed with
the dock inside the viewport, no board overlap, 16 named grid cells, and four
live regions.

Repository validation at this checkpoint:

- script syntax, diff whitespace, spellcheck, and TypeScript passed;
- focused unit suites passed 11 tests;
- focused mobile/accessibility browser suites passed 34 tests;
- the corrected full production browser suite passed 9 tests;
- the physical reduced-motion and background/resume checks passed.

Exact next step: with the user's awareness, briefly enable TalkBack on the
connected Pixel, perform the five-item human speech/interaction pass above,
restore TalkBack to its original disabled state, record the result here, mark
the parent Phase 6 accessibility checklist item complete only if it passes,
then commit, push, and verify the final exact-SHA deployment. Do not include the
pre-existing uncommitted `scripts/v2-phase0-pixel-console.mjs` change unless
the user separately authorizes it.
