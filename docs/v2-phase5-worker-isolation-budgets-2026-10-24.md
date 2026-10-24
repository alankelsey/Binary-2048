# V2 Phase 5 worker isolation and budgets — 2026-10-24

## Decision before infrastructure change

This slice closes only the fifth Phase 5 item: research jobs run outside
gameplay capacity with explicit per-pool concurrency, CPU/time, cost, and alarm
boundaries. It does not claim that shared Mongo capacity is immune to research
load; that remains part of the later gameplay-under-load acceptance item.

The deployed audit found two encrypted SQS queues and two on-demand Lambda
functions outside the Amplify gameplay compute plane:

| Pool | Tasks | Queue/function | Hard execution boundary |
| --- | --- | --- | --- |
| Research compute | simulation and tournament | `binary2048-v1-tournament` | batch 1, event-source maximum concurrency 2, 2,048 MiB, 60 seconds, two attempts |
| Training | replay and label generation | `binary2048-v1-training` | batch 1, event-source maximum concurrency 2, 2,048 MiB, 60 seconds, two attempts |

Lambda assigns CPU in proportion to memory; 2,048 MiB is therefore the CPU
allocation proxy rather than an independently configurable vCPU setting. AWS
documents SQS maximum concurrency as an event-source-level hard limit. The
account currently has a regional concurrency quota of 10, all unreserved, so
function reserved concurrency is deliberately not added: it cannot be safely
partitioned while retaining AWS's required unreserved pool. The two mapping
limits still prevent either queue from invoking more than two concurrent
workers, and Amplify gameplay does not consume this Lambda concurrency pool.

References:

- [AWS SQS event-source maximum concurrency](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-scaling.html)
- [AWS Lambda CPU/memory and timeout behavior](https://docs.aws.amazon.com/lambda/latest/dg/troubleshooting-configuration.html)
- [AWS Lambda concurrency behavior](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html)

## Cost and admission boundary

The existing 25 jobs/principal/UTC-day and 250 jobs/UTC-month limits remain.
The shared monthly allowance is now partitioned before queue dispatch:

- research compute: 150 admitted jobs/UTC month;
- training: 100 admitted jobs/UTC month; and
- global: 250 admitted jobs/UTC month.

Each admitted job is costed conservatively as up to two 60-second, 2 GiB
attempts. At the planning rate already recorded in the V1 cost decision, the
class envelopes are 36,000 GB-seconds for compute and 24,000 GB-seconds for
training, 60,000 GB-seconds combined. Admission counters are hard application
stops; the existing $50 monthly AWS Budget is an account-level delayed alert,
not a spending circuit breaker. AWS explicitly warns that costs can continue
after a budget threshold is crossed.

The class defaults may be lowered through
`BINARY2048_WORKER_MONTHLY_COMPUTE_JOBS` and
`BINARY2048_WORKER_MONTHLY_TRAINING_JOBS`. Increasing them is not a routine
configuration change: their sum must remain within the fixed global 250-job
cap unless the cost decision and tests are revised together.

Reference: [AWS Budgets behavior and notification delay](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).

## Monitoring boundary

Before this slice, neither worker had a CloudWatch alarm. The stack will attach
separate alarms for each pool to the existing confirmed alarm-notification SNS
topic:

- Lambda errors or throttles above zero;
- p95 duration at or above 55 seconds;
- concurrency at the pool limit for three consecutive minutes;
- oldest queued message above five minutes for two minutes; and
- any message visible in the pool's dead-letter queue.

AWS recommends Lambda duration, errors, throttles, and concurrency plus SQS
oldest-message age for serverless workload monitoring. Missing data is treated
as healthy because these workers are intentionally idle most of the time.

References:

- [AWS Lambda metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html)
- [AWS serverless metrics and alarms](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/opex-metrics-and-alerts.html)
- [AWS SQS failure/backpressure metrics](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html)

## Measured baseline

The 14-day pre-change window ending 2026-10-24 recorded four compute-pool and
two training-pool invocations, zero Lambda errors, zero throttles, maximum
concurrency two during acceptance, and maximum daily p95 durations of 477 ms
and 720 ms respectively. The 55-second duration alarm therefore detects a
material approach to the enforced timeout without tuning against idle noise.

The deployed account also has a $50 monthly cost budget and a confirmed email
subscriber on `Default_CloudWatch_Alarms_Topic`. Worker resources receive
project and workload-class tags for future cost attribution; tag activation in
Cost Explorer is an account operation and is not claimed by this slice.

## Preserved boundaries

This design does not change job submission/status/result shapes, research
scopes, API-key quota identity, principal ownership, ownerless-job expiry,
request/body/aggregate-compute caps, two-attempt execution, 24-hour job TTL, or
12 MiB result storage. The worker queues remain on-demand and outside a VPC;
no NAT, provisioned concurrency, always-on poller, or new paid analytics service
is introduced.

## Candidate validation

The stable candidate passed:

- focused worker, route, OpenAPI, inventory, and drift coverage: 11 suites,
  74 tests;
- the complete unit matrix: 176 suites, 676 tests;
- the complete UI matrix: 77 passed, two expected skips;
- TypeScript generation and checking;
- worker artifact compilation and CloudFormation template validation; and
- optimized production compilation plus the packaged-build smoke test.

The infrastructure drift test locks both pools at batch one, maximum
concurrency two, 2,048 MiB, and 60 seconds; locks the twelve alarms and their
notification action; and rejects accidental reserved-concurrency or tagging
drift. Queue admission tests independently lock the compute, training, owner,
and global counters before any message is sent.

The V2 checklist is now 39/84 (46.4%). The whole roadmap remains 347/374
(93%). The measured 35% delivery-efficiency comparison remains open. This
slice used two bounded discovery/verification batches below the 5,000-token
aggregate ceiling, one focused expansion, one full unit run, one full UI run,
and one successful final build after the build gate identified and the focused
test confirmed a type-only lint correction.

## Deployment and production acceptance

Runtime commit `5f1f39381be1ea126ae5152509dd464ecd18eeaf` was deployed worker-first.
The `binary2048-v1-workers` stack reached `UPDATE_COMPLETE` with artifact SHA-256
`24c146c95321a4b0cd64fca249ce28c4ec3ba50408de6e27ae145ab747b9bf40`.
The deployed acceptance re-read both function and event-source controls,
verified all twelve actionable alarms, and completed simulation, tournament,
replay, and label jobs on their first attempts.

Amplify job 433 then deployed that exact runtime commit successfully. The
standard production smoke passed on its first attempt. A credential-safe live
acceptance submitted a simulation and received `202`, polled the owned job to
`complete` with the V2 status contract, and retrieved the completed result from
the dedicated result endpoint. No production credential was printed or stored
in this evidence.
