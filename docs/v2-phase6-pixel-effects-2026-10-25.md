# V2 Phase 6 target-Pixel effect profiling

Date: 2026-10-25 America/Boise

Status: protocol and static inventory complete; physical Pixel capture pending.
No visual CSS has been changed.

## Objective

Measure the paint, raster, layer-update, composite, and frame-pipeline cost of
the special-tile presentation on the target Pixel before simplifying any
visual. The measurement covers both persistent wildcard/Lock-0 decoration and
the four transient cell effects. It does not use a desktop or emulated mobile
result as a substitute for physical-device evidence.

## Rendered-effect inventory

The board contains only 16 cells in the default game. The potentially expensive
work is narrowly scoped:

| Case | Current presentation | Duration |
| --- | --- | ---: |
| Baseline | transform/opacity pulse without a filter or animated shadow | 420 ms |
| Number merge | transform plus animated outer `box-shadow` | 260 ms |
| Wild merge | transform, animated `filter` saturation/hue rotation, and outer `box-shadow` | 340 ms |
| Zero bust | transform, opacity, border color, and two animated outer shadows | 420 ms |
| Spawn | transform, opacity, and animated outer `box-shadow` | 210 ms |
| Wildcard tile | persistent three-layer shadow plus two icon text shadows | persistent |
| Lock-0 tile | persistent three-layer shadow plus two icon text shadows | persistent |

`will-change` is currently declared for zero-bust and spawn, including
`box-shadow`; it is not declared for either merge effect. Reduced motion
collapses the four transient animations to 1 ms and disables the win burst.
The unrelated shell backdrop filters are outside this first board-effect
profile.

## Checked-in measurement tool

`scripts/v2-phase6-pixel-effects.mjs` reuses the privacy-safe Phase 0 CDP
attachment approach. It requires one visible, portrait production tab and
refuses the standard profile when the OS reports reduced motion. For each case
it temporarily changes the first visible board cell, runs eight activations,
restores the cell in a `finally` block, and closes that case's trace before the
next case. It does not make a move, mutate React or server state, inspect
storage/network/auth data, or retain a raw trace.

The baseline and persistent wildcard/Lock-0 cases use the same Web Animations
transform/opacity pulse. Each persistent case also changes the cell from a
number to the real special-tile markup on every activation, so it includes the
initial paint/raster cost of the tile and icon shadows as well as their cost
while the tile is composited. Transient cases use the exact production CSS
classes. Output contains only aggregate event counts/durations,
long-task count, frame-gap summary, orientation, reduced-motion state, and the
fixed public target label.

Chrome trace events establish browser paint/composite pipeline work, not actual
physical display presentation. The report must preserve that limitation.

## Physical Pixel protocol

Record only Pixel family, Android major, Chrome major, portrait orientation,
UTC capture time, footer commit, and whether the tab is guest or authenticated.
Do not retain a serial, full user agent, IP, SSID, identity, cookies, tokens,
storage values, screenshot, HAR, or raw trace.

1. Deploy the exact candidate and pass the normal production smoke.
2. On the unlocked target Pixel, disable battery saver, select the standard
   motion setting, close other foreground apps, and open
   `https://www.binary2048.com/` in Chrome in portrait. Start a default game and
   leave the tab visible with no dialog over the board.
3. Enable USB debugging, approve the workstation, and forward the Pixel Chrome
   browser-debugging socket to local port 9222 using the same Phase 0 setup.
   Do not open Network or Application panels.
4. Confirm the footer commit and run `npm run ops:v2:pixel-effects`. Do not touch
   the device during the roughly 30-second capture.
5. Review the aggregate JSON, copy only its `context` and `cases`, then discard
   terminal scrollback containing any unexpected data. The script keeps the raw
   trace only in memory and releases each case after aggregation.
6. Repeat the entire run once. A conclusion requires the same expensive-case
   ordering in both runs; report materially divergent runs instead of choosing
   the favorable one.
7. Separately enable Android Remove animations/reduced motion, trigger each
   effect through normal gameplay, and verify that state-change feedback is
   visible without sustained animation. This qualitative check is not mixed
   into the standard-motion trace.

If port 9222 is unavailable, the device is not approved, the tab is hidden,
portrait is false, reduced motion is enabled, the exact tab is ambiguous, or a
trace exceeds its bounded in-memory limit, stop and record no performance
conclusion.

## Declared interpretation

Compare each transient case with baseline and each persistent-shadow case with
baseline across both runs. Investigate a visual simplification when an effect:

- creates a main-thread task over 50 ms;
- repeatedly coincides with draw-frame gaps over 33.4 ms; or
- adds at least 1 ms of paint plus raster time per activation and at least 20%
  over baseline in both captures.

Event counts alone are diagnostic and are not a regression. A change should
target only the measured property, retain the semantic feedback and
reduced-motion behavior, and repeat this identical protocol before acceptance.
If none of the gates trigger, retain the visuals and close the profiling item
without speculative CSS churn.

## Evidence available now

The source inventory above was verified at commit `c8c600e`. The measurement
tool passes syntax validation and its help/refusal path can be exercised without
a device. No CDP endpoint is listening at `127.0.0.1:9222` in the current
workspace, and device enumeration was not authorized, so there is no physical
Pixel result to report yet. The Phase 6 checklist deliberately remains open
until two valid target-device captures and the reduced-motion check are added
to this document.
