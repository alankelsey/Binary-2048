# V2 Phase 0 browser and device acceptance

Date: 2026-10-13 America/Boise (desktop capture: 2026-10-14 UTC; Pixel capture:
2026-10-15 UTC)

Status: complete. Desktop Google Chrome guest/authenticated measurements and the
physical Pixel Chrome gesture/frame protocol passed. Phase 0 is closed.

## Measurement contract

`scripts/v2-phase0-browser-measurement.mjs` launches the installed Google Chrome
channel visibly at 1440×900. It runs one classified pre-game rejection, 20 paced
keyboard inputs, and a 10-input rapid burst against production. It correlates
successful client traces with HTTP status and the allowlisted `Server-Timing`
header by request order. A mismatch, non-200 response, dropped paced input, or
unclassified rapid input fails the run.

The retained JSON projection omits trace, game, session, user, account, request,
recovery, cookie, token, signature, URL-path, and payload identifiers. Ignored
raw artifacts are mode `0600`; only the aggregate evidence below is checked in.
Playwright tracing, HAR, screenshots, video, and the diagnostic game log were
disabled or unused.

The application metric spans recognized input capture through the next
animation-frame callback after React commit. That callback is a paint
opportunity, not proof that pixels were presented. The evidence therefore calls
it `input-to-next-frame`; physical Pixel acceptance adds Chrome frame-track
observation rather than overstating this metric as actual paint.

## Desktop production result

Target: `https://www.binary2048.com`, deployed commit `501ee19`, Google Chrome
155.0.8059.79 on macOS, viewport 1440×900 at device-pixel ratio 1.

| Context | UTC capture | Paced classified | Input-to-next-frame median / p95 / max | Server total median / p95 / max |
|---|---|---:|---:|---:|
| Guest | 2026-10-14 01:21:44 | 20/20 | 252.3 / 814.0 / 1603.5 ms | 30.16 / 48.13 / 50.11 ms |
| Authenticated | 2026-10-14 01:22:31 | 20/20 | 365.7 / 659.0 / 1708.2 ms | 40.85 / 51.23 / 65.07 ms |

Both paced runs had zero drops and every completed client record matched one
HTTP 200 move response with a valid server-timing projection. The authenticated
run used the ignored saved OAuth state and verified the page's authenticated
marker; no identity was retained.

The guest rapid burst classified all ten inputs as one accepted, eight queued,
and one explicit `queue_full` drop. The authenticated burst produced the same
classification. Queued traces contained capture, enqueue, and dequeue depth
samples; the dropped trace contained capture and drop depths plus its fixed
reason. A valid pre-game arrow was separately classified once as
`game_unavailable`, demonstrating that a rejected directional input is distinct
from a queued one.

Server execution was a small share of the end-to-next-frame distribution in
these samples. Guest server medians were 12.36 ms for session lookup, 16.10 ms
for persistence, and 30.16 ms total. Authenticated medians were 12.47 ms,
25.13 ms, and 40.85 ms respectively. Client-side/network gaps remain labeled by
phase rather than assigned a cause; authentication bridge work is currently part
of the unattributed capture-to-request interval.

## Physical Pixel production result

Target: `https://www.binary2048.com`, deployed commit `e911256`, Pixel 10 family,
Android 17, Chrome 155, portrait on Wi-Fi, guest state. Capture completed
2026-10-15 UTC. No serial, full user agent, identity, SSID, IP, cookie, token,
storage value, screenshot, HAR, or raw trace was retained.

| Run | Classified result | Input-to-next-frame median / p95 | Acceptance |
|---|---|---:|---|
| Deliberate, eight swipes | 8 accepted, 0 queued, 0 dropped | 221.0 / 634.0 ms | Passed |
| Rapid, six swipes | 6 accepted, 0 queued, 0 dropped | 251.8 / 509.7 ms | Passed |
| Faster retry, six swipes | 6 accepted, 0 queued, 0 dropped | 252.4 / 457.8 ms | Passed |

Every completed swipe had one valid `Server-Timing` projection and every valid
swipe was classified. The physical bursts did not fill the queue because each
request completed before the next recognized gesture crossed threshold; this is
reported as observed rather than treated as queue-saturation evidence. The
desktop rapid runs already proved accepted, queued, and `queue_full`
classification under controlled saturation.

A board tap and an outside-board swipe left the move count at 14 and created
zero completed/dropped records and zero move requests. A separate attached,
memory-only Chrome performance recording observed the React-commit and
next-frame marks followed by `BeginFrame`, `DrawFrame`, and `Paint`; only that
sanitized result was retained and the raw trace was discarded.

The interruption and multi-touch boundary runs also passed. Locking the device
during a held board contact created no move record or request, and a fresh swipe
completed normally. Both two-finger lift orders created no move record or
request; the fresh single-finger swipe after each sequence completed exactly
once with a valid timing projection.

## Physical Pixel Chrome protocol

Record only the Pixel family, Android major, Chrome major, portrait orientation,
network class (Wi-Fi or cellular), UTC time, footer commit, and guest/authenticated
state. Omit device serial, full user agent, account identity, SSID, IP, cookies,
tokens, and storage values.

1. Enable USB debugging, connect and unlock the Pixel, approve this computer,
   and open `https://www.binary2048.com` in Pixel Chrome.
2. In desktop Chrome, open `chrome://inspect/#devices` and inspect the Binary
   2048 tab. Do not open Network or Application data or save a HAR, screenshot,
   or unreviewed trace.
3. Start a default Normal game in portrait. In the remote Console, clear the
   three app aggregates with the snippet below, then detach DevTools during the
   gestures.
4. Deliberate run: perform eight long real-finger swipes, Left, Down, Right, Up
   twice, waiting for the prior board response each time. Reattach after the
   board settles and export the sanitized projection. All eight valid gestures
   must be classified with no drops.
5. Rapid run: clear again, detach, then perform exactly six long swipes with no
   pause: Left, Down, Right, Up, Left, Down. Reattach after settlement and export.
   Every valid gesture must be completed or explicitly dropped; queued records
   must contain enqueue and dequeue depths.
6. Ignored controls: after another clear/detach, tap without dragging on the
   board and swipe beside the board. Both are intentionally non-move gestures and
   must leave the performance-entry count and Moves value unchanged.
7. Run one separate single-swipe frame observation with remote DevTools attached:
   start a Performance recording, swipe once without interacting with DevTools,
   stop after the board settles, and inspect the frame/paint events following the
   React-commit and next-frame marks. Record a sanitized yes/no observation with
   UTC time and discard the raw trace after review. Chrome pipeline events do not
   prove physical display presentation, so retain the existing metric limit.
8. Touch-boundary run: begin a swipe and trigger a system cancellation or app
   interruption, then make a fresh valid swipe. Next, touch with a second finger,
   lift the fingers in each order, and make another fresh valid swipe. Cancelled
   and multi-touch sequences must create no move request or classified move
   record; each following single-finger swipe must complete normally. Retain only
   pass/fail counts, not raw touch or device data.

Clear command:

```js
performance.clearMarks('binary2048:move-complete');
performance.clearMarks('binary2048:move-dropped');
performance.clearMeasures('binary2048:move-input-to-next-frame');
performance.clearResourceTimings();
```

Sanitized extractor:

```js
(() => {
  const round = n => Math.round(n * 100) / 100;
  const allowed = new Set(['rate_limit_identity','rate_limit_counter','request_parse','session_lookup','recovery_verify','recovery_replay','recovery_import','engine_move','session_persist','snapshot_build','snapshot_sign','response_encode','total']);
  const required = ['rate_limit_identity','rate_limit_counter','request_parse','session_lookup','engine_move','session_persist','snapshot_build','snapshot_sign','response_encode','total'];
  const completed = performance.getEntriesByName('binary2048:move-complete').map(e => {
    const d = e.detail || {};
    const phases = Array.isArray(d.phases) ? d.phases : [];
    const first = phases.find(p => p.phase === 'input_capture');
    const last = phases.find(p => p.phase === 'next_animation_frame');
    return {
      source: d.source,
      disposition: phases.some(p => p.phase === 'queued') ? 'queued' : 'accepted',
      queueDepths: Array.isArray(d.queueDepthSamples)
        ? d.queueDepthSamples.map(s => ({ stage: s.stage, depth: s.depth })) : [],
      inputToNextFrameMs: first && last ? round(last.atMs - first.atMs) : null
    };
  });
  const dropped = performance.getEntriesByName('binary2048:move-dropped').map(e => ({
    source: e.detail?.source,
    disposition: 'dropped',
    reason: e.detail?.dropReason,
    queueDepths: Array.isArray(e.detail?.queueDepthSamples)
      ? e.detail.queueDepthSamples.map(s => ({ stage: s.stage, depth: s.depth })) : []
  }));
  const resources = performance.getEntriesByType('resource').filter(e => {
    const url = new URL(e.name);
    return url.origin === location.origin && /\/api\/games\/[^/]+\/move$/.test(url.pathname);
  });
  const serverTimings = resources.map(resource => {
    const result = {};
    for (const metric of resource.serverTiming || []) {
      if (!allowed.has(metric.name) || metric.name in result || !Number.isFinite(metric.duration) || metric.duration < 0) throw new Error('Invalid Server-Timing projection');
      result[metric.name] = round(metric.duration);
    }
    if (required.some(name => !(name in result))) throw new Error('Missing required Server-Timing metric');
    return result;
  });
  if (serverTimings.length !== completed.length) throw new Error('Client/server sample count mismatch');
  const values = completed.map(x => x.inputToNextFrameMs).filter(Number.isFinite).sort((a,b) => a-b);
  const nearest = p => values.length ? values[Math.max(0, Math.ceil(values.length * p) - 1)] : null;
  return {
    capturedValidGestures: completed.length + dropped.length,
    accepted: completed.filter(x => x.disposition === 'accepted').length,
    queued: completed.filter(x => x.disposition === 'queued').length,
    dropped: dropped.length,
    droppedByReason: dropped.reduce((a, x) => ((a[x.reason] = (a[x.reason] || 0) + 1), a), {}),
    inputToNextFrameMs: { median: nearest(.5), p95: nearest(.95) },
    events: completed.map((event, index) => ({ ...event, serverTimingMs: serverTimings[index] })).concat(dropped)
  };
})()
```

Acceptance requires zero unclassified valid swipes, one valid server-timing
projection per completed move, coherent queue depths,
intentionally ignored controls producing no move record, and an observed Chrome
frame/paint after the recorded update. Explicit `busy` or `queue_full` drops are
observability passes and Phase 1 correctness findings; they are not silent loss.

The checked-in `scripts/v2-phase0-pixel-console.mjs` performs exact-origin/tab
selection and emits only the sanitized status, counts, or projection above.
`scripts/v2-phase0-pixel-frame.mjs` keeps its bounded trace in memory, emits only
the frame/paint observation, and discards the trace on exit. Both attach through
Chrome's browser-level approval path and detach after each operation.
