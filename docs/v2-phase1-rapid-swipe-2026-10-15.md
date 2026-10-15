# V2 Phase 1 rapid-swipe evidence

Date: 2026-10-15

Status: complete. Rapid touch input has physical Pixel evidence and a
deterministic browser-input acceptance test in addition to the existing
rapid-arrow and mixed-input coverage.

## Physical result

On Pixel 10-family Chrome 155 with Android 17, an initial six-swipe burst and a
faster six-swipe retry each classified and completed all six touch gestures.
Neither physical burst filled the queue because each response completed before
the next recognized swipe crossed threshold. No gesture was silently lost, and
every completed move had one valid server-timing projection. Full sanitized
device evidence is recorded in
[`v2-phase0-browser-device-acceptance-2026-10-13.md`](./v2-phase0-browser-device-acceptance-2026-10-13.md).

## Deterministic browser-input result

`tests/ui/rapid-swipe.browser.spec.ts` uses Chrome's `Input.dispatchTouchEvent`
protocol at a 412×915 touch viewport. This exercises the browser input path
rather than constructing DOM `TouchEvent` objects in page code. The test holds
the first move response, dispatches ten directional swipes without waiting for
the board, and then releases the response.

Acceptance proved:

- the first touch move executed and the next eight entered the FIFO;
- all nine accepted directions reached the move route exactly once and in
  capture order;
- request concurrency never exceeded one;
- all completed traces reported source `touch`;
- each queued trace included enqueue and dequeue depth samples; and
- the tenth touch move was explicitly classified as `queue_full` at depth
  eight with accessible queue feedback remaining covered by the mixed-input
  test.

Focused validation passed one test in Chromium. The complete UI suite passed 58
tests with one expected diagnostics skip. The full unit suite passed 161 suites
and 555 tests, and TypeScript validation passed. The production bundle compiled
and generated all 62 pages; local post-build smoke reached the expected
environment-only 503 because the production auth-bridge secret is unavailable
locally.

The physical evidence and controlled saturation test together satisfy the Phase
1 rapid-swipe item without claiming that normal human finger speed must fill the
queue. During full validation, the existing 360×640 tutorial fit check exposed a
short-screen overflow. The tutorial board now uses a height-scoped narrow width
on screens no larger than 560×700; the isolated regression and full UI suite
both passed after the repair.
