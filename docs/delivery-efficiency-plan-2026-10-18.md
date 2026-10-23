# Binary 2048 delivery-efficiency plan — 2026-10-18

Status: implemented controls; measured V2 pilot pending.

## Purpose

Reduce the context, tool output, elapsed time, and repeated work needed for each
Binary 2048 delivery slice without reducing implementation quality, acceptance
coverage, deployment verification, or the quality of fresh-session handoffs.

The Phase 3 session-compaction slice is the baseline. Its product work was
successful, but its workflow spent avoidable tokens on broad file dumps, a
large diff review, overlapping focused tests, a repeated production build, and
frequent deployment polling.

## Targets

- Reduce read and command-output tokens by at least 35% on a comparable slice.
- Run the full unit suite, applicable full browser suite, and production build
  once after the implementation reaches a stable candidate.
- Keep iterative validation focused on the changed contract and its direct
  consumers.
- Avoid a second build unless production code, build configuration, or a
  build-checked file changes after the first successful build.
- Cut deployment-status tool calls by at least half while still reporting
  meaningful progress at least once per minute.
- Preserve exact commit, Amplify job, production smoke, progress, and clean
  worktree evidence in every completed V2 handoff.

These are workflow targets rather than quotas. A failure, uncertain migration,
security-sensitive change, or newly discovered consumer justifies broader
inspection and repeated validation.

## 1. Targeted discovery

- [x] Start each slice from the handoff's named files and next checklist item.
- [x] Use symbol search to build a changed-surface map before opening complete
  files.
- [x] Read narrow ranges around definitions and consumers; do not reload whole
  evidence documents already summarized by the handoff unless a claim must be
  verified.
- [x] Cap ordinary discovery output at 2,000 tokens per command and split only
  when the first result identifies a real dependency.
- [x] Record the intended files, contracts, and acceptance tests before editing
  so unrelated consumers do not expand the slice accidentally.

Acceptance: a representative slice reaches an implementation decision without
any source or diff dump above 5,000 tokens, unless the evidence notes why the
larger read was required.

## 2. Test ladder

- [x] During implementation, run only the smallest affected unit or route
  tests and one focused browser test when browser behavior changes.
- [x] After focused tests pass, review the final changed surface before running
  release gates.
- [x] Run TypeScript, the full unit suite, the applicable full browser suite,
  and the optimized production build once on the stable candidate.
- [x] If only tests or documentation change after a successful build, rerun the
  affected test or lint check; repeat the build only when a build-checked file
  changed or the prior build result no longer represents the commit.
- [x] Keep the existing rule that new behavior needs meaningful coverage; token
  reduction is not a reason to omit migration, recovery, integrity, or
  long-session tests.

Acceptance: the slice evidence lists focused validation separately from one
final release matrix and explains every repeated full gate.

## 3. Concise tool output

- [x] Add a repository helper that runs Jest while preserving the exit code and
  prints the final suite/test summary plus failures, rather than every passing
  suite.
- [x] Add an equivalent concise Playwright wrapper that prints totals,
  failures, and the expected diagnostics skip.
- [x] Prefer `git diff --check`, `git diff --stat`, and changed-function hunks;
  reserve a complete diff dump for small changes or unresolved review risk.
- [x] Keep routine status commands to branch cleanliness, the last two commits,
  and local/remote SHA equality.

Acceptance: the helpers fail exactly when the underlying command fails, retain
actionable failure output, and are covered by a dry-run or fixture check before
becoming the default delivery commands.

## 4. Deployment monitoring

- [x] Change V2 deployment monitoring from 15-second reporting to a default
  45-second poll, while retaining the existing timeout and exact-commit check.
- [x] Report to the user at meaningful state transitions or approximately once
  per minute during a long deployment, not for every unchanged poll.
- [x] Keep final job status, deployed commit SHA, and production smoke as
  mandatory evidence.

Acceptance: a normal three-minute Amplify deployment uses no more than five
status retrievals and still detects the wrong commit or a failed job.

## 5. Release-evidence decision

- [x] Evaluate whether runtime job and smoke evidence must be committed into the
  repository or can remain in the final handoff and an existing external job
  record.
- [ ] If repository evidence remains mandatory, investigate an officially
  supported Amplify skip-build mechanism for evidence-only commits in a
  non-production proof before changing the release workflow.
- [x] Do not use force-push, commit amendment after deployment, or an unverified
  skip marker to avoid the second deployment.
- [x] Document the selected policy and its audit/recovery tradeoff.

Acceptance: either the evidence-only deployment is eliminated safely, or the
project explicitly records why the second deployment remains required.

Decision: retain the second deployment for now. The checked-in evidence and the
fresh-session handoff currently promise that `main`, the exact successful
Amplify job, and production all identify the same commit. AWS officially
supports ending a commit message with [`[skip-cd]`](https://docs.aws.amazon.com/amplify/latest/userguide/edit-build-settings.html#skip-build)
to suppress its automatic build, but using it for the evidence commit would
break that equality. A non-production proof remains open before changing this
release invariant; until then, the extra deployment is the explicit cost of
repository-local, commit-addressable evidence.

## 6. Measure the pilot

Use the next self-contained V2 slice as the pilot. Its evidence should record:

- number of discovery commands and any output above 5,000 tokens;
- focused test runs and repeated full gates;
- production build count;
- deployment status retrieval count;
- whether an evidence-only deployment occurred; and
- any defect or missed dependency caused by the streamlined workflow.

After the pilot, compare the result with the session-compaction baseline. Adopt
the workflow only if release confidence is unchanged and the 35% output-token
reduction is met. Otherwise revise the helpers or targets before using them as
the default V2 delivery process.

## Safeguards

The following remain mandatory when relevant:

- deterministic engine and client/server parity evidence;
- recovery, replay, undo, export, schema migration, and ranked-integrity tests;
- physical-device acceptance when the roadmap calls for it;
- a clean, synchronized worktree;
- exact Amplify commit/job verification; and
- final production smoke.

Efficiency measurements must never record secrets, identifiers, game payloads,
or raw authenticated traffic.

## Implementation verification

The workflow controls were implemented on 2026-10-18:

- `test:unit:concise` and `test:ui:concise` use repository reporters that retain
  complete failures and final counts while suppressing per-pass output.
- `test:delivery-tools` covers formatter counts, a real Playwright fixture,
  combined Amplify polling, and exact-commit mismatch failure.
- CI uses the concise Jest reporter.
- the Amplify watcher defaults to a 45-second interval, emits unchanged status
  at most once per minute, fetches status and commit in one request, and accepts
  `EXPECT_COMMIT_ID` as a fail-closed release guard.
- developer documentation records the focused-test and stable-candidate test
  ladder.

Verification passed with six delivery-tool tests, 168 unit suites / 609 tests,
69 UI tests with one expected skip, TypeScript, and the optimized production
build smoke. The UI run also found and corrected a stale assertion that accepted
only legacy recovery snapshots after compact recovery became the preferred
export proof.

Runtime commit `0e117d6` deployed successfully as Amplify job 409. Its watcher
used five combined status/commit retrievals over 184 seconds, enforced the full
expected commit SHA, and was followed by a passing production smoke. This meets
the deployment-monitoring acceptance bound.

The roadmap item remains open until a comparable V2 product slice measures the
35% output-token target and confirms unchanged release confidence.

The first product pilot was the Phase 3 schema/recovery migration on 2026-10-19.
It kept iterative tests focused and found both a hidden browser downgrade path
and a compile-error reporting gap before the final matrix. Three combined
discovery reads exceeded the 5,000-token limit, however, so the 35% reduction is
not claimed. The next pilot must split all discovery reads at the hard limit;
see the [slice evidence](./v2-phase3-schema-recovery-migration-2026-10-19.md).

The second product pilot was the Phase 5 OpenAPI audit and explorer prototype
on 2026-10-21. Exact route drift detection and focused browser coverage shipped
without a missed production dependency, but one discovery batch exceeded the
5,000-token target and a pre-existing build-smoke authentication dependency
caused repeated build output. The 35% reduction is still not claimed; the next
pilot should cap source reads before execution and run the auth-complete smoke
harness on the first release build. See the
[slice evidence](./v2-phase5-openapi-audit-2026-10-21.md).

The third product pilot completed the Phase 5 priority contract metadata on
2026-10-21. Focused and full gates found no missed dependency, and the release
build passed on its first run. The initial parallel discovery result still
exceeded 5,000 combined output tokens even though each child command was
bounded. The 35% target remains open; future parallel discovery must cap the
aggregate returned output. See the
[slice evidence](./v2-phase5-openapi-contract-metadata-2026-10-21.md).

The fourth product pilot completed the Phase 5 workload-entry-point inventory
on 2026-10-22. It added executable-surface and security-boundary drift coverage
without finding a missed product dependency. One source batch still reported
more than 5,000 aggregate tokens, the browser gate needed two environment-only
retries, and the build needed a second compilation after its disposable auth
environment was absent from the first compile. The standalone smoke then
needed host permission to bind its local port. The 35% target remains open;
future runs must start the UI server and supply the build-smoke environment
before the one-time release gates. See the
[slice evidence](./v2-phase5-workload-inventory-2026-10-22.md).

The fifth product pilot is the Phase 5 asynchronous research-job conversion.
Discovery remained split into batches below 5,000 returned tokens, and the
contract/compatibility behavior was documented before operator polling changed.
Final test, build, and deployment counts are recorded in the
[slice evidence](./v2-phase5-async-research-jobs-2026-10-23.md). The measured
35% reduction remains open until those totals establish a comparable gain with
unchanged release confidence.
