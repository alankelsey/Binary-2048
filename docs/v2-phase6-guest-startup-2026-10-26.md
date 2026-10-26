# V2 Phase 6 guest-shell startup measurement

<!-- cspell:ignore contentful localabstract -->

Date: 2026-10-26 America/Boise

Status: complete. Production measurement confirms that asynchronous auth
hydration no longer blocks guest game-shell readiness.

## Objective

Measure guest startup before and after the Phase 4 asynchronous-auth change,
while keeping the comparison honest about differences in capture time and
instrumentation. The result must show whether the guest game shell is usable
before auth completes, not merely whether a later production request happened
to be faster.

## Before state

The pre-change root layout was async and rendered an `AuthShell` that awaited
`getOptionalServerSession` before returning the page. Five no-cache production
HTML samples recorded in the 2026-09-17 performance analysis had an
approximately 216 ms median response-header time and an approximately 18.1 KB
HTML body. There was no independent game-shell readiness mark because the
server auth lookup was structurally ahead of the returned shell.

That historical sample is useful directional evidence, not a controlled
same-runtime benchmark: CDN state, runtime warmth, network conditions, and the
deployed application all changed between captures.

## After state

Runtime commit `b0c8d1d` removed the request-time root-layout session lookup.
The static shell renders immediately, and the client `AuthShell` requests the
session after hydration. Protected controls remain fail closed until a
positive authenticated state arrives.

The checked-in `scripts/v2-phase6-pixel-startup.mjs` harness attaches to one
visible production tab through the privacy-safe Pixel CDP path. It performs
three to ten cache-bypassed reloads and records only public deployment/device
context plus Navigation Timing, Paint Timing, and the existing
`binary2048:game-shell-ready`, `binary2048:auth-hydration-start`, and
`binary2048:auth-hydration-complete` marks. It does not inspect or retain
cookies, tokens, storage, request bodies, identity, IP, SSID, screenshots,
HARs, or raw traces.

Run with:

```sh
adb forward tcp:9222 localabstract:chrome_devtools_remote
BINARY2048_EXPECT_COMMIT=05b48fe npm run ops:v2:pixel-startup
```

## Physical Pixel result

Target: `https://www.binary2048.com/`, deployed commit `05b48fe`, Pixel 10 Pro
XL, Android 17, Chrome 156, portrait on Wi-Fi, guest state. Five
cache-bypassed reloads completed on 2026-10-26 UTC.

| Metric | Median | Range | p95 |
| --- | ---: | ---: | ---: |
| Response start | 62.2 ms | 42.3-163.0 ms | 163.0 ms |
| First contentful paint | 208.0 ms | 144.0-460.0 ms | 460.0 ms |
| Game shell ready | 179.5 ms | 143.1-492.0 ms | 492.0 ms |
| Auth hydration complete | 342.0 ms | 277.5-630.5 ms | 630.5 ms |
| Shell lead over auth completion | 145.4 ms | 134.4-162.5 ms | 162.5 ms |

The game shell became ready before auth completion in all five runs. The lead
was stable even when the first reload was slower overall, establishing that
auth latency is outside the guest shell's readiness path. Browser timing is not
a server-only measurement and does not by itself assign delay to the network,
browser, React, or the runtime.

## Same-protocol response-header comparison

Five new no-cache production HTML requests used the same basic protocol as the
historical sample. Response-header times were 384.5, 167.6, 162.2, 350.4, and
170.6 ms, for a 170.6 ms median. Each response body was 13,169 bytes. Compared
with the historical 216 ms and approximately 18.1 KB observations, the median
was about 21% lower and the body about 27% smaller.

The request sample remains noisy and cross-date, so it is supporting evidence
rather than a causal estimate. The decisive acceptance evidence is the
per-navigation ordering on the target Pixel: the usable shell consistently
precedes auth completion while protected UI remains fail closed.

## Decision

Close the Phase 6 guest-startup item. No additional auth-shell optimization is
justified by this sample. Reopen only if production monitoring or user reports
show a startup regression, and keep authenticated-control authorization outside
the guest shell's critical rendering path.
