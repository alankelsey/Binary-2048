# V2 Phase 4 critical diagnostic retention — 2026-10-19

Status: complete for critical-signal retention. Phase 4 remains open.

## Retention policy

Normal production retains errors, warnings, state regressions, slow
acknowledgements, prediction divergence, recovery fallback, and cumulative
input-drop counts. Routine request, response, persistence, export, replay, and
matching-prediction success events are omitted unless detailed support tracing
is enabled by the existing support-log build flag.

An acknowledgement is slow at 750 ms or longer from request start through body
parse. Its retained entry includes direction, attempt, duration, status, and a
sanitized game reference. A recovery retry records whether it used a compact
checkpoint tail or legacy snapshot.

Input drops share one retained aggregate entry. Each reason and the total count
increase in place, with the latest reason and timestamp recorded. Rapid queue
saturation therefore preserves the count without consuming the entire
250-entry ring. Clearing the log resets both the ring and the aggregate.

Error hooks remain installed even when the support UI is compiled out, while
routine success tracing creates no entries. Existing redaction, chronological
ring behavior, closed-panel rendering behavior, copy, and clear semantics are
preserved.

## Acceptance evidence

- Policy unit coverage proves critical retention, omission of routine success,
  suppression of matching reconciliation, and detailed-support override.
- Ring coverage continues to prove bounds, rollover, ordering, and clearing.
- The dedicated browser suite proves two modal-blocked inputs become one
  cumulative drop entry and an 800 ms response emits a slow-acknowledgement
  entry.
- The same browser path retains state regression, prediction divergence,
  console errors, redaction, copy, close/reopen, and clear behavior.
- Final validation passed 168 unit suites with 619 tests, 70 UI tests with one
  expected diagnostics-only skip, the dedicated support-log test with its one
  expected configuration skip, TypeScript, and the optimized production build
  smoke.
- Full-suite load exposed two pre-existing fixed-time test races. The tutorial
  test now reopens New Game through the visible UI instead of clearing durable
  storage during a pending coalesced write, and the delayed-move test waits for
  the observable active request instead of sleeping for 75 ms.

## Delivery-efficiency pilot

Discovery used six bounded commands and no output exceeded 5,000 tokens.
Focused validation used one unit run, one TypeScript run, and two dedicated
browser iterations; the first browser iteration identified the New Game guard
behavior. The final release matrix found and removed two test-only timing races
before passing. No product dependency was missed. This slice remains smaller
than the session-compaction baseline, so the comparative 35% workflow target
remains open.
