# V2 Phase 4 lazy optional tools — 2026-10-20

Status: complete for optional-tool lazy loading. Phase 4 remains open.

## Runtime boundary

The active game shell keeps its board, move controls, New Game flow, and the
small buttons that reveal optional tools in the initial client bundle. Work
needed only after an explicit user action now loads through separate chunks:

- authenticated game-import conversion and error mapping;
- replay-file and shared-replay parsing;
- export filename selection and JSON download creation;
- hosted replay-link construction and export-error mapping;
- diagnostic log formatting; and
- the expanded advanced-help body.

The support log continues to retain critical entries in its bounded ring while
its formatter is absent. Opening or copying the log loads the formatter and
formats the latest snapshot. A failed formatter load exposes a retry action;
copy failure leaves a bounded status message. Import, replay, export, and replay
sharing retain their existing error surfaces and can be retried through the
same control.

Advanced help loads only after its native disclosure opens. It announces a
loading status, presents an alert if its chunk fails, and offers a Retry help
button. Closing it removes the optional body without affecting game state or
move controls.

## Bundle measurement

The baseline production build at `ff86b2a` loaded 93,492 raw route-specific
JavaScript bytes for `/` (27,367 bytes gzip). The final stable-candidate build
loads 92,425 raw route-specific bytes (27,045 bytes gzip), a reduction of 1,067
raw bytes (1.1%) and 322 gzip bytes (1.2%). It creates six separate optional
chunks totaling 3,864 raw bytes for help, import, replay parsing, export, replay
sharing, and diagnostic formatting; the browser fetches each only when its
feature is used.

## Acceptance evidence

- Focused unit coverage preserves diagnostics formatting, export filename,
  replay parsing, and import conversion behavior.
- Focused browser coverage proves the help chunk is not requested before the
  disclosure opens, loading is announced, content appears after loading, a
  failed first chunk request produces an alert, and retry succeeds.
- Existing import and diagnostics browser paths continue to cover optional
  actions through their production UI controls.
- Final unit, browser, support-log, TypeScript, and production-build results
  are recorded with release acceptance below.

## Delivery-efficiency pilot

Discovery remained targeted to the Phase 4 checklist and direct consumers, but
one combined source-read batch exceeded the 5,000-token output target. Focused
validation found only test-locator specificity issues; no product dependency
was missed. The 35% comparable-slice target remains open.

## Validation

- Focused optional-helper unit suites: 4 suites / 15 tests passed.
- Focused lazy-help browser suite: 2 tests passed, including failed-load retry.
- Full unit suite: 168 suites / 619 tests passed.
- Full local browser suite: 72 tests passed, 1 expected diagnostics-only skip.
- Dedicated support-log suite: 1 test passed, 1 expected configuration skip.
- TypeScript, lint for changed production files, and optimized production build
  smoke passed. Changed-file lint retained two pre-existing hook warnings.
- The full browser matrix found one stale synchronous replay-share assertion;
  it now waits for the observable compact-export request before checking its
  payload, and the repeated full matrix passed.

## Production acceptance

- Runtime commit `afc250c` deployed successfully in Amplify job 417.
- The watcher verified the exact full commit SHA and used three combined
  status/commit retrievals over 139 seconds.
- Production smoke passed against `https://www.binary2048.com` after job 417.
