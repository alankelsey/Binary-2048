# Hosting operations bridge design (2026-10-28)

<!-- cspell:words HMAC -->

## Decision

For any web-runtime migration proof, retain the accepted AWS worker, SQS, S3,
CloudWatch, and alarm boundary first. Do not give a third-party web runtime
broad AWS credentials and do not replace every operational subsystem in the
same migration.

## Web-to-AWS authorization

Use a narrow HTTPS submission bridge in AWS in front of the existing queues and
artifact services. The bridge validates a short-lived, audience-bound HMAC or
OIDC assertion issued only to the deployed web runtime, then performs the AWS
operation under its own least-privilege role.

- Separate audiences/scopes for tournament submission, training submission,
  replay artifact write/read, and log ingestion.
- Bind assertions to deployment environment and request digest; enforce a
  maximum five-minute lifetime and replay nonce.
- Keep queue URLs, bucket names, and AWS resource policies server-side.
- Permit only the existing queue message schemas and S3 prefix/content limits.
- Record subject, deployment/version, operation, resource class, result, and
  request ID without logging credentials or gameplay payloads.

Static AWS access keys in Vercel, Netlify, Cloudflare, or VPS environment
variables are not the target design. A candidate-native workload-identity
federation may replace the bridge only after its token claims and AWS trust
policy are proven more narrowly scoped.

## Logs and telemetry

Add a provider-neutral structured-log envelope at the application boundary.
Candidate-native logs remain useful for immediate debugging, while an
authenticated bounded batch sink forwards the accepted fields to the existing
CloudWatch telemetry namespace.

- Preserve event name, route, status class, duration, deployment ID, runtime
  region, request ID, and redacted error classification.
- Cap event and batch sizes; reject unknown schema versions and client-supplied
  identity fields.
- Buffer outside gameplay input handling and drop optional telemetry rather
  than delaying moves.
- Alert on missing ingestion as well as application errors, so a silent logging
  outage cannot be mistaken for healthy traffic.

## Deploy, health, and rollback

Every candidate adapter must implement the same release contract:

1. build an immutable artifact without runtime secrets;
2. deploy a non-serving version and record its provider version ID;
3. run health, OAuth callback, storage, gameplay, replay, and worker-submission
   probes against that version;
4. promote traffic only after probes pass;
5. retain the previous version and one-command rollback;
6. rerun post-promotion probes and automatically roll back on the defined
   failure threshold.

The release record stores source commit, artifact hash, provider version,
configuration version, promotion/rollback timestamps, probe results, and
operator identity.

## WAF, rate limits, and alarms

- Use the candidate's native edge WAF only after its authoritative client-IP
  field is proven. Application rate limits continue to use the shared Mongo
  counter for protected/API-key traffic.
- Preserve route-specific limits and bot/API-key exemptions from the current
  policy; do not translate them into a single global request cap.
- Export sampled blocked-request evidence with rule ID, action, timestamp, and
  redacted request metadata.
- Alarm on 5xx rate, latency, storage connectivity, queue age/depth, replay
  bridge failures, log-ingestion gaps, WAF blocks, and cost/spend thresholds.
- Keep SQS worker and S3/CloudWatch alarms in AWS while those services remain;
  candidate-native alarms cover only the migrated web boundary.

## Exit tests for a candidate proof

The bridge is accepted only after cross-environment denial, expired/replayed
assertion denial, over-size payload denial, least-privilege AWS policy
simulation, successful queue/artifact operations, log delivery, deploy
promotion, forced health failure, rollback, and retained incident evidence.
