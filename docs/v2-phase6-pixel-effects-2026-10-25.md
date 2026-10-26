# V2 Phase 6 target-Pixel effect profiling

Date: 2026-10-25 America/Boise

Status: complete. The measured compositor-only candidate passed local
validation, exact-SHA deployment, two post-change Pixel captures, and the
repeat reduced-motion check.

## Current continuation state

The profiling tool and protocol were deployed at commit `46de7d0`. Amplify job
441 succeeded for that exact SHA, and the standard production smoke passed.
Two standard-motion captures, two property-isolation captures, two
compositor-only probes, and the initial reduced-motion check then completed on
the target Pixel against deployed commit `2e9d55f`. The candidate at
`09ca5ed` removed only the measured repainting transient properties while
retaining effect timing, scale/opacity feedback, persistent special-tile
styling, and the reduced-motion contract. Amplify job 443 deployed that exact
SHA successfully. Two repeat production captures and the final reduced-motion
check passed on the target Pixel, closing this profiling item.

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

## Physical Pixel result

Target: `https://www.binary2048.com/`, deployed commit `2e9d55f`, Pixel 10 Pro
XL, Android 17, Chrome 156, portrait on Wi-Fi, guest state. Captures completed
2026-10-25 UTC. No serial, full user agent, identity, SSID, IP, cookie, token,
storage value, screenshot, HAR, or raw trace was retained.

The table reports aggregate `Paint` plus raster duration divided by eight
effect activations. Values are not elapsed animation durations.

| Case | Run 1 paint / raster / combined | Run 2 paint / raster / combined |
| --- | ---: | ---: |
| Baseline transform/opacity | 2.36 / 3.66 / 6.02 ms | 3.07 / 2.12 / 5.19 ms |
| Number merge | 10.07 / 21.55 / 31.62 ms | 9.90 / 22.61 / 32.51 ms |
| Wild merge | 8.26 / 72.19 / 80.45 ms | 8.38 / 78.68 / 87.06 ms |
| Zero bust | 16.61 / 35.79 / 52.40 ms | 16.82 / 42.03 / 58.85 ms |
| Spawn | 8.61 / 17.14 / 25.75 ms | 8.18 / 15.16 / 23.34 ms |
| Persistent wildcard styling | 2.50 / 5.56 / 8.06 ms | 4.74 / 4.72 / 9.46 ms |
| Persistent Lock-0 styling | 3.17 / 3.89 / 7.06 ms | 2.88 / 4.25 / 7.13 ms |

Every case in both runs had zero main-thread tasks over 50 ms. Chrome 156 did
not emit `CompositeLayers` or `UpdateLayerTree` duration events in these
captures. Draw-frame gaps are retained only as diagnostic output: the harness
waits 480 ms between activations, so effects shorter than 420 ms intentionally
produce idle gaps and their gap p95 is not a frame-stall comparison.

All four transient cases exceeded the declared paint-plus-raster investigation
gate in both runs. Persistent wildcard styling also exceeded it, but by only
2.04 and 4.27 ms over baseline; Lock-0 did not exceed the percentage gate in
both runs. The transient effects were therefore isolated first without changing
the persistent special-tile appearance.

## Property isolation and candidate probe

Each diagnostic used the production class and suppressed only the named CSS
property with an inline `!important` override. Removing spawn's animated shadow
reduced combined work to 3.88 and 2.84 ms per activation. Removing wildcard
shadow reduced wild merge to 68.73 and 49.63 ms; removing its filter alone did
not produce a stable improvement. Removing zero-bust shadow reduced it to 47.27
and 44.21 ms. Number merge without shadow remained 26.65 and 28.64 ms. These
results show that removing a single property is insufficient when the remaining
animation still causes per-frame rasterization.

The final probe fixed repainting shadow/filter/border color and added short-lived
`will-change: transform, opacity`, matching a compositor-only source candidate:

| Candidate probe | Run 1 combined | Run 2 combined | Baseline range |
| --- | ---: | ---: | ---: |
| Number merge | 0.00 ms | 0.00 ms | 5.19–6.02 ms |
| Wild merge | 3.53 ms | 3.45 ms | 5.19–6.02 ms |
| Zero bust | 2.10 ms | 1.92 ms | 5.19–6.02 ms |

The source candidate consequently keeps each effect's existing duration and
transform curve, adds opacity feedback where a glow was removed, limits
`will-change` to transform/opacity, and removes animated `box-shadow`, wildcard
`filter`, and zero-bust `border-color`. Persistent wildcard and Lock-0 shadows
and icon text shadows remain unchanged. Spawn uses its already-declared
transform/opacity promotion without its animated shadow.

With Android Remove animations enabled, Chrome reported
`prefers-reduced-motion: reduce`; number merge, wild merge, zero bust, and spawn
each computed to a 0.001-second animation. The visible sequence produced no
reported sustained pulse, and the original cell was restored after the check.

## Post-change physical Pixel result

Target: `https://www.binary2048.com/`, deployed commit `09ca5ed`, Pixel 10 Pro
XL, Android 17, Chrome 156, portrait on Wi-Fi, guest state. Captures completed
2026-10-26 UTC. The same privacy limits and trace interpretation used for the
baseline apply.

The table reports aggregate `Paint` plus raster duration divided by eight
effect activations and compares each run with its corresponding pre-change
run. Values are Chrome trace pipeline timing, not elapsed animation durations
or direct physical-display measurements.

| Case | Run 1 combined / reduction | Run 2 combined / reduction |
| --- | ---: | ---: |
| Baseline transform/opacity | 6.47 ms / reference | 7.71 ms / reference |
| Number merge | 3.02 ms / 90.4% | 2.89 ms / 91.1% |
| Wild merge | 2.87 ms / 96.4% | 3.18 ms / 96.3% |
| Zero bust | 2.78 ms / 94.7% | 3.28 ms / 94.4% |
| Spawn | 2.21 ms / 91.4% | 2.33 ms / 90.0% |
| Persistent wildcard styling | 6.19 ms / unchanged presentation | 10.01 ms / unchanged presentation |
| Persistent Lock-0 styling | 7.78 ms / unchanged presentation | 7.68 ms / unchanged presentation |

All cases in both post-change runs again had zero main-thread tasks over 50 ms.
The four transient effects no longer exceed the paint-plus-raster investigation
gate; each is below the same-run transform/opacity baseline. Persistent
wildcard and Lock-0 styling was intentionally retained, and no persistent-style
regression was observed.

For the final four-second accessibility verification, Android Remove
animations was enabled and Chrome again reported
`prefers-reduced-motion: reduce`. Number merge, wild merge, zero bust, and
spawn each computed to a 0.001-second animation. Remove animations was then
returned to its original off state.

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

The source inventory above was verified at commit `c8c600e`; no visual source
changed in the initial profiling checkpoint. Commit `46de7d0` was pushed to
`main`, deployed successfully by Amplify job 441, and passed the standard
production smoke on 2026-10-25. The documentation-only continuation commit
`2e9d55f` deployed successfully in Amplify job 442 and also passed the standard
production smoke. Candidate commit `09ca5ed` passed the focused style tests,
full unit suite, production build, Amplify job 443 exact-SHA deployment, two
post-change Pixel captures, and the repeat reduced-motion check. The measured
90.0-96.4% transient paint/raster reductions, zero long tasks, and retained
persistent styling complete the Phase 6 profiling item.
