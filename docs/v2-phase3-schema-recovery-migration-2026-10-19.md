# V2 Phase 3 schema and recovery migration — 2026-10-19

Status: complete. Phase 3 is complete.

## Compatibility boundary

The accepted versions are explicit and additive:

| Stored or imported shape | Behavior |
| --- | --- |
| Unversioned stored session | Deterministically replay and migrate to session schema V2 |
| Stored session V1 | Deterministically replay and migrate to session schema V2 |
| Stored session V2 | Validate compact steps and undo-state storage before use |
| Future or malformed current session | Fail closed as unavailable storage; never coerce it to V2 |
| Unversioned or V1 full game export | Import for backwards compatibility |
| Recovery snapshot V1 | Import and retain the existing signature and integrity rules |
| `checkpoint-tail-v1` compact recovery | Import only with its bounded tails and trusted signed checkpoint |
| Future full-export, recovery, or compact version | Return an explicit HTTP 400 compatibility error |

Uploaded future full exports are rejected in the browser before a request is
sent. This prevents the file adapter from downgrading an unknown export into a
recovery V1 envelope. Corrupt and unknown compact local-storage records remain
fail closed and cannot fall back to an unrelated legacy record.

## Migration and recovery behavior

Legacy stored sessions still migrate lazily. A read reconstructs compact
commands and the remaining bounded undo states; the next successful mutation
persists schema V2 through the existing optimistic revision check. V2 records
must already contain structurally valid compact steps and an undo-state array.
Unknown versions and malformed V2 records surface as storage failures instead
of being rewritten.

Recovery snapshot V1 and its signed payload are unchanged, so deployed clients
and saved checkpoints remain compatible. Compact recovery continues to replay
only the bounded acknowledged tail after a trusted checkpoint. Full exports
without a version remain supported as the oldest import shape, while numeric
versions newer than V1 are rejected rather than guessed.

## Acceptance evidence

- Unversioned and explicit V1 stored-session fixtures migrate to V2.
- Future stored versions and malformed V2 records fail closed.
- Import routes accept legacy unversioned exports and all supported V1 recovery
  forms.
- Future full-export, recovery-snapshot, and compact-recovery envelopes return
  explicit compatibility errors.
- A browser upload of a future full export shows the version error and sends no
  import request.
- Existing recovery signatures, compact tail bounds, move, export, undo, and
  250-plus-move coverage remain in the release matrix.

## Delivery-efficiency pilot

This slice used 16 discovery commands. Three early combined reads exceeded the
5,000-token target; later inspection stayed narrow. Focused validation included
four unit iterations, one delivery-helper run, and one browser spec. The first
unit failure exposed a concise-reporter defect that hid compile-only suite
errors; the reporter now retains those diagnostics. Targeted consumer search
also found the browser downgrade path before the final release matrix.

No dependency was missed after the changed-surface review. The final full unit,
UI, TypeScript, and build gates ran once on the stable candidate. The 35%
token-reduction target is not claimed for this pilot because the discovery
output limit was exceeded; the delivery-workflow roadmap item remains open for
one stricter measured slice.

## Validation

- Delivery-tool regression suite: 7 tests passed.
- Full unit suite: 168 suites / 616 tests passed.
- Full local browser suite: 70 tests passed, 1 diagnostics-only test skipped.
- TypeScript and optimized production build smoke passed.
- One production build and one full release matrix were run on the stable
  candidate. A test-only lint cleanup afterward reran its affected route test
  and ESLint check without repeating the production build.

## Release verification

- Runtime commit `46cc609` deployed successfully in Amplify job 411.
- The watcher used four combined status/commit retrievals over 139 seconds and
  matched the complete expected SHA.
- Production smoke checks against `https://www.binary2048.com` passed.
