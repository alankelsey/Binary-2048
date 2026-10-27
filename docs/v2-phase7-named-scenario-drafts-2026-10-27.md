# V2 Phase 7 named scenario-draft evidence

Date: 2026-10-27 America/Boise

Status: complete.

## Storage contract

- Draft records use `draftVersion: 1`, a stable ID, a bounded name, creation and
  update timestamps, and a complete cloned scenario-builder state.
- Local storage uses the versioned `binary2048.scenarioDrafts.v1` key and keeps
  the 25 most recently updated drafts. Corrupt, unsupported, or structurally
  invalid records are ignored safely.
- Drafts intentionally allow in-progress scenarios whose probabilities do not
  yet total one or whose board has no legal move. Structural bounds, supported
  tile shapes, dimensions, and configuration types are still enforced.
- Authenticated account storage uses the shared MongoDB pool and the
  `scenario_drafts` collection. Records have a unique owner-and-draft index and
  an owner-and-update-time listing index.
- The API hashes the authenticated email or name into an opaque owner ID before
  any storage call. List, replace, and delete queries always include that owner
  ID; responses never expose it. Unauthenticated requests return 401, session
  lookup failures return 503, and all responses disable caching.

## User experience

- The builder can name, save, overwrite, load, and delete drafts on the current
  device. Loading resets edit history to the restored board.
- Authenticated users can save privately to their account, refresh their private
  list, load an account draft, and delete it. Authentication or storage failures
  are reported in the draft status region without affecting local drafts.
- All draft actions have explicit accessible names and at least 44-pixel touch
  targets. A 390 × 844 mobile capture was inspected with the local and account
  controls wrapping cleanly and without horizontal overflow.

## Verification

- Three draft-schema tests cover cloning, versioning, timestamps, corruption,
  ordering, naming, and safe IDs.
- Four API tests cover authentication, opaque owner hashing, version rejection,
  owner-scoped saving, and owner-scoped deletion.
- The scenario-builder unit suites pass 12 tests. The focused browser suite
  passes 7 tests, including save, full-page reload, restore, deletion, touch
  painting, keyboard operation, previews, and screen-reader announcements.
- TypeScript, ESLint, spelling, and diff validation pass.
