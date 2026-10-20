# V2 Phase 4 explicit support mode — 2026-10-20

Status: complete for explicit detailed success tracing. Phase 4 remains open.

## Runtime contract

Support mode is off by default and can be enabled only through the visible
Support diagnostics panel. Activation is local to the browser, lasts 30
minutes, survives reload, displays its expiry time, and can be disabled
immediately. Corrupt or expired preferences are removed. Expiration and manual
disable both close the log, clear its in-memory contents, and stop detailed
success retention before later events are recorded.

Critical errors, warnings, state regressions, slow acknowledgements,
prediction divergence, recovery fallback, and cumulative input-drop counts
remain retained while support mode is off. Enabling support mode adds routine
request, response, persistence, export, replay, and matching-reconciliation
events to the same bounded 250-entry ring. It does not change gameplay,
prediction, request ordering, persistence, or server behavior.

The panel remains visible while mode is off so activation is discoverable, but
Show Log, Copy Log, and Clear Log appear only while mode is active. Formatting
remains lazy and occurs only on open, copy, or an open-panel revision.

## Privacy boundary

Every structured diagnostic detail passes through one sanitizer before the
retention decision and ring write. Identity, session/game/user/account IDs,
state hashes, email, credential, signature, secret, password, raw body, and
payload fields are discarded. Existing string redaction remains in place for
console and error messages. Diagnostic code records derived status, timing,
direction, queue, turn, and count data; it does not record recovery snapshots
or authenticated request traffic.

## Acceptance evidence

- Unit coverage proves bounded enable/restore behavior and removal after
  expiration, corruption, and explicit disable.
- Unit coverage proves identity, hash, credential, and payload detail fields
  are removed while operational counts remain.
- The normal browser configuration proves support mode starts off, routine
  startup success is omitted, and a critical console error retained while off
  becomes visible after explicit activation.
- The support browser configuration proves enable, detailed move/export/replay
  tracing, reload persistence, visible active status, immediate disable,
  local-storage removal, expired-state cleanup, redaction, structured identity
  removal, lazy formatting, copy, clear, and chronological retention.

## Delivery-efficiency pilot

Discovery used four bounded commands, although one combined source read
exceeded the 5,000-token output target. Focused validation used one unit run,
one TypeScript run, one normal browser run, and two support-browser iterations;
the first support iteration found only an ambiguous role locator. No product
dependency was missed. The comparative 35% target remains open.

## Validation

- Focused support-mode and diagnostics suites: 2 suites / 9 tests passed.
- Normal diagnostics browser path: 1 test passed, 2 configuration skips.
- Dedicated support-log path: 2 tests passed, 1 configuration skip.
- Full unit suite: 169 suites / 622 tests passed.
- Full local browser suite: 72 tests passed, 2 expected support-configuration
  skips.
- TypeScript, changed-file lint, and optimized production build smoke passed;
  changed-file lint retained two pre-existing hook warnings.

## Production acceptance

- Runtime commit `bf5abc9` deployed successfully in Amplify job 419.
- The watcher verified the exact full commit SHA with four combined
  status/commit retrievals over 192 seconds.
- Production smoke passed against `https://www.binary2048.com` after job 419.
