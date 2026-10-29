# Hosting portability audit (2026-10-28)

<!-- cspell:words HMAC -->

## Result

The web runtime is not currently portable as a drop-in artifact. Application
gameplay code is largely platform-neutral, but authentication, persistence,
workers, artifacts, observability, secrets, and deployment automation have
provider or Node-runtime dependencies. A migration must retain the AWS worker
boundary initially or replace each dependency explicitly.

## Repository inventory

| Area | Current dependency | Migration requirement |
| --- | --- | --- |
| Cryptography | Node `crypto` HMAC/hash/timing-safe comparison | Candidate must provide compatible Node crypto semantics and stable byte encoding. |
| MongoDB | Native driver 6.20; shared process client; transactions in inventory | Prove TCP/TLS, sessions/transactions, connection reuse, timeouts, regional placement, and Atlas controls. |
| Authentication | NextAuth v4 route handler, GitHub OAuth, signed bridge tokens/cookies | Prove callbacks, redirects, secure cookie behavior, runtime secrets, and sign-in/out on the candidate. |
| Queue compute | AWS SDK SQS client and separate accepted workers | Retain SQS/worker AWS boundary first, or add an authenticated provider-neutral queue bridge. |
| Replay artifacts | AWS SDK S3 client and bucket policy | Retain S3 with scoped credentials or implement an equivalent immutable artifact store. |
| Observability | Amplify/runtime logs, CloudWatch workflows, WAF logs/alarms | Deliver structured route logs to the accepted aggregator; replace deploy and WAF evidence automation. |
| Scheduling | GitHub Actions production smoke/regional/browser schedules | These can remain provider-neutral if secrets and target URLs are updated. |
| Build | Next.js 15, custom webpack callback, filesystem reads in `next.config.mjs` | Candidate adapter must reproduce route/build output and remove provider-specific configuration. |
| Runtime limits | 57 route handlers; simulation/training workloads can be long/heavy | Keep heavy jobs on workers; measure route bodies, duration, memory, streaming, and concurrency. |
| Rollback | Amplify watcher plus AWS scripts/evidence | Define candidate version promotion, health checks, rollback command, and retained evidence. |

## Secret boundary

`next.config.mjs` currently copies authentication, recovery, admin, MongoDB,
queue, and S3 values into Next's build-time `env` because of an Amplify
WEB_COMPUTE limitation. This is accepted only for the current baseline. Any
migration design must remove all non-public values from `next.config.mjs` and
read them from runtime-only secrets. Reusable build artifacts must contain only
`NEXT_PUBLIC_*` release metadata.

## Deployment boundaries

The lowest-risk candidate proof moves only the Next.js web runtime while
retaining Atlas plus AWS SQS workers, S3 artifacts, CloudWatch aggregation, and
the scheduled GitHub acceptance jobs. This still requires scoped AWS
authorization from the new web runtime and includes retained AWS/Atlas costs.

Moving additional services is a second, independent boundary. It requires new
queue semantics, worker isolation, artifact retention, alarms, and incident
evidence; it must not be bundled into a web-hosting price comparison.

## Fail-closed and proof requirements

The candidate must run the existing storage, recovery, OAuth, gameplay,
replay, worker submission, and ops-authorization tests. Required production
stores must reject missing configuration/connectivity rather than selecting
memory. The candidate's authoritative client-IP field must be documented and
tested before it is trusted for rate limiting. Preview success alone is not a
portability proof.
