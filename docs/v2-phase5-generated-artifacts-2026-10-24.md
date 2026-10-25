# V2 Phase 5 generated artifacts — 2026-10-24

## Decision before implementation

This slice closes only the sixth Phase 5 item: generated research artifacts
are persisted once by the worker and read back without regenerating them in an
Amplify request. It does not perform the later gameplay-under-worker-load
acceptance.

The audited production job path already computes simulation, tournament,
training-replay, and training-label results in isolated Lambda workers. Its
remaining storage flaw is that the worker embeds as much as 12 MiB of result
data in the same Mongo document used for status polling. Contract-v2 status
projects that field out, but legacy status and result reads still load the
large job document. The result is not recomputed, yet job metadata and the
generated artifact are not independently bounded or addressable.

The stable contract is:

- the artifact id is the owning 64-hex job id;
- the worker serializes the result exactly once as JSON, rejects more than
  12 MiB before storage, and records its byte length and SHA-256 digest;
- the artifact uses schema `worker-result-v1`, media type
  `application/json`, the submitting principal, creation time, and the same
  absolute expiry as its job;
- artifacts live in a separate `worker_artifacts` Mongo collection with an
  absolute-time TTL index; job documents retain only bounded artifact
  metadata;
- a job is marked complete only after its artifact is durable;
- status/result authorization continues to resolve the non-expired job first,
  enforce its principal ownership, and only then read the referenced artifact;
- the result reader verifies id, owner, byte length, and SHA-256 before parsing
  JSON; a missing or corrupt artifact fails closed rather than regenerating;
- pre-change jobs with an inline result remain readable through their existing
  24-hour TTL; and
- unversioned status retains its deprecated inline-result response shape by
  loading the stored artifact after authorization. Contract-v2 status remains
  metadata-only and directs clients to the result endpoint.

MongoDB limits one BSON document to 16 MiB, so the existing 12 MiB JSON ceiling
leaves room for the small artifact envelope. Separating the payload from the
frequently polled job follows MongoDB's guidance to reference a second
collection when large fields are not needed by common queries. The existing
shared Mongo deployment and 24-hour retention make a new bucket, public URL,
presigned credential, or paid service unnecessary for this short-lived
contract.

References:

- [MongoDB BSON document limit](https://www.mongodb.com/docs/manual/reference/limits/)
- [MongoDB guidance for reducing large documents](https://www.mongodb.com/docs/cloud-manager/schema-advisor/reduce-document-size/)
- [MongoDB absolute-time TTL indexes](https://www.mongodb.com/docs/v8.0/tutorial/expire-data/)

## Inventory disposition

| Path | Disposition |
| --- | --- |
| Worker simulation, tournament, training replay, and training label results | Persist as `worker-result-v1` artifacts; never regenerate during status/result reads. |
| `GET /api/jobs/{id}` contract v2 | Read bounded job metadata only. |
| `GET /api/jobs/{id}` unversioned compatibility | Authorize the job, then load and verify the stored artifact to preserve the deprecated inline result. |
| `GET /api/jobs/{id}/result` | Authorize the job, then load and verify the stored artifact; retain old inline-job fallback until those jobs expire. |
| Canonical run replay download | Already reads a persisted inline or checksummed S3 replay through `run-store`; no change. |
| Game export, compact replay, encoded state, replay validation/postmortem, and scenario execution | Keep synchronous. These are bounded deterministic gameplay/support transformations, not generated research batches, and storing every representation would add writes and invalidation without removing long-running work. |
| Operator dataset export/feature extraction/model training | Keep as local operator artifacts outside the web runtime. |

Scope grants, API-key quota identity, principal ownership, ownerless-job
compatibility, request and aggregate-compute caps, per-class and global job
budgets, two-attempt execution, queue isolation, polling limits, and gameplay
behavior do not change.

## Current continuation state

The stable candidate is implemented and the Phase 5 checklist points to this
record. Amplify job 435 deployed compatibility-reader commit
`34edbaf4696919fff1f3f3c7066cc599cecefed8`, and its first-attempt production
smoke passed. Worker artifact
`c7f85fc485d59b96e53aea2ba27ecfc5941c3471ddf408b9907cea272575204f`
then reached `UPDATE_COMPLETE`, and live artifact acceptance passed. The only
remaining release rule is that any commit carrying this final evidence must
itself pass the exact Amplify deployment, production smoke, and clean-sync
checks before work advances. The web reader deployed before the worker writer
as an expand/contract migration: the new web code reads both legacy inline
results and `worker-result-v1`, while the old web code cannot read a new
artifact-only job. The next unchecked V2 plan item is the controlled
gameplay-under-worker-load test. This section is maintained as gates change so
a continuation can resume from repository state without a generated handoff
prompt.

## Candidate validation

The candidate passed:

- focused artifact, job-route, OpenAPI, and inventory validation: eight suites
  and 56 tests after one wording-only OpenAPI expectation correction;
- the final focused worker suite: nine tests, including the 12 MiB pre-storage
  rejection, persistence-before-completion, owner mismatch, and digest/length
  corruption;
- the complete unit matrix: 176 suites and 681 tests;
- the complete UI matrix: 77 passed with two expected skips;
- TypeScript generation and checking;
- worker artifact compilation; and
- optimized production compilation plus packaged-build smoke.

V2 progress is 40/84 (47.6%). Whole-roadmap progress remains 347/374 (93%).
The measured 35% delivery-efficiency comparison remains open. Repository
discovery was otherwise bounded, but the canonical Google Drive document tool
returned a 15,767-token structured response before truncation, exceeding the
5,000-token aggregate discovery ceiling. Focused validation ran once after the
implementation stabilized, apart from the single failed OpenAPI wording
assertion and its one-suite correction. The full unit, UI, TypeScript, worker,
and production-build gates each ran once against the stable candidate.

## Deployment and production acceptance

Implementation commit `5959b74` and the compatibility rollout record were
deployed together at
`34edbaf4696919fff1f3f3c7066cc599cecefed8` in Amplify job 435. The exact-SHA
watcher reported success after 147 seconds, and the standard production smoke
passed on its first attempt before the worker writer changed.

Worker artifact
`c7f85fc485d59b96e53aea2ba27ecfc5941c3471ddf408b9907cea272575204f`
then updated `binary2048-v1-workers` successfully. Direct worker acceptance
verified the existing isolation controls and twelve alarms, then verified that
simulation, tournament, training replay, and training label jobs each:

- completed on the first attempt;
- stored `worker-result-v1` outside the job document;
- retained the submitting owner; and
- matched their recorded byte length and SHA-256.

A credential-safe production HTTP acceptance received `202` for simulation,
observed a completed contract-v2 status with no inline result, retrieved the
stored `binary2048-v1` result through the dedicated result route, and confirmed
that an unversioned status request loaded the same stored result for legacy
compatibility. No credential or raw artifact was printed or committed.
