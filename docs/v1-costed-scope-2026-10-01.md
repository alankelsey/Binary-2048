# V1 remaining work: scope and cost proposal

Date: 2026-10-01. Status: partially approved for implementation on 2026-10-01.

## Owner decision — 2026-10-01

Approved: tournament/training workers, inventory and session persistence, shared
ops data and console. Dev environment and isolated WAF testing move to the end
of V2. Do not add NAT, always-on workers, another paid database, or paid analytics.
The active estimate is therefore $40–46/month total ($0–6 incremental), subject
to the workload assumptions below. No additional approval is needed for these
authorized costs. The original proposal below is retained for pricing context;
its dev/WAF execution steps and approval-pending language are superseded.

## Baseline and recommendation

The owner reports AWS at $28/month and MongoDB at $12/month with fewer than
three users: $40/month, or $480/year. These are reported totals, not an audited
service breakdown. MongoDB's tier, billing period, taxes, credits, and operation
volume have not been verified. The older $150/month monetization planning
target is not the current infrastructure bill.

Target an incremental $2–10/month for the remaining V1 architecture under the
bounded workload below: approximately $42–50/month total. Reserve $5–10 once
for an isolated WAF acceptance exercise. These are engineering estimates, not
provider caps or a guarantee. Do not provision or activate metered features
under this document alone. Existing V1 gates remain open until their acceptance
evidence exists; no scope is transferred to V2 by this proposal.

## Why three users can still cost $40

Amplify charges $15/month per app for WAF integration. Standard WAF pricing
adds $5/month per ACL and $1/month per billable rule or managed-rule-group
attachment, plus request charges. The checked-in game API template has three
managed groups and two rate rules: an illustrative fixed total of $25/month.
This could explain most of the $28 AWS bill, but the deployed rule count and
invoice must be checked. Sources: [Amplify firewall pricing](https://docs.aws.amazon.com/amplify/latest/userguide/waf-pricing.html)
and [WAF pricing](https://aws.amazon.com/waf/pricing/).

Builds, synthetic gameplay tests, crawlers, and research jobs also generate
usage independently of player count. The repository schedules both smoke and
browser synthetic checks four times daily. Measure their costs before changing
the existing coverage.

## Costed work packages

| Work | Deliverable and acceptance | Additional monthly allowance | Engineering effort |
| --- | --- | --- | --- |
| Billing baseline | Reconcile one full month of service/usage-type charges, credits, builds, logs, WAF, and Atlas operations; identify ongoing versus development costs | $0 infrastructure | 0.5–1 day |
| Dev environment | Same Amplify app, separate `dev` branch/domain, branch secrets, OAuth app, DB-scoped credential and `binary2048_dev` database; deny production writes; smoke/auth/rollback acceptance | $2–4 | 1–2 days |
| Isolated WAF acceptance | Temporary separate Amplify app and cloned ACL; bounded threshold test, sampled request and retained block log, then teardown | $0 ongoing; $5–10 once | 1 day |
| Dedicated workers | Separate tournament/training SQS queues and on-demand Lambda functions; job status/results, retry-safe jobs, DLQs, cost quotas and gameplay isolation proof | $0–2 | 3–5 days |
| Transactional inventory | Existing Atlas deployment if supported; atomic balance/ledger/idempotency updates, concurrent consumption tests, webhook retry proof, export/delete integration | Shares $0–2 DB allowance below | 3–5 days |
| Session persistence | Awaited asynchronous store contract, real cold-instance reads, version/concurrency checks, durable writes, expiry and recovery parity | Combined inventory/session DB allowance $0–2 | 2–3 days |
| Shared ops and console | Shared league/model configuration, fleet telemetry from durable events, bounded aggregate reads, authorized read-only UI with accessibility and cross-instance acceptance | $0–2 | 3–5 days |
| Release acceptance | Run deployment, auth, browser, storage and rollback checks; record actual costs and close only proven gates | Included above | 1–2 days |

Rough total: 15–25 engineering days including integration and acceptance, not a
delivery-date commitment. Dollar allowances exclude labor, payment processing,
hosted-model inference, taxes and unrelated subscriptions. Existing production
usage is assumed unchanged. New DB usage is counted once, not once per feature.

## Dev and WAF design

An ACL attached to an Amplify app covers its branches. Therefore the dev branch
can inherit existing protection without another integration fee. The branches
share WAF policy and resource capacity: this is logical data/secret isolation,
not a fully independent security boundary. Do not test production ACL changes
on this branch. [Amplify WAF integration](https://docs.aws.amazon.com/amplify/latest/userguide/amplify-waf-configuration.html)
documents the app-wide association.

For firewall acceptance, create a separate short-lived app and ACL with only
synthetic data. Copy relevant production rule behavior, use a documented lower
test threshold if necessary, capture the actual blocked request and retained
log, and verify cleanup of the app, ACL and test data. A 48-hour deployment with
five billable WAF entries has about $25 × 48 / 730 = $1.64 in fixed firewall
charges; $5–10 allows for builds, requests, logs and a rerun. Record any lower
test threshold rather than claiming the production threshold itself was tested.

The permanent dev estimate assumes 20–40 extra standard builds/month, averaging
five minutes: $1–2 for builds, plus $1–2 for hosting/test usage. Standard builds
cost $0.01/minute before credits. If permanent independent WAF policy is needed,
use a separate app/ACL and add roughly $25/month for the same five-entry policy;
the resulting total is about $67–75/month. [Amplify pricing](https://aws.amazon.com/amplify/pricing/)

## Worker and data cost assumptions

Use on-demand Lambda outside a VPC, avoiding NAT and idle compute. This retains
the existing Atlas network-access posture; it does not complete fixed egress.
Use two bounded queues, low worker concurrency, explicit job admission limits,
maximum execution duration, finite retries and bounded result retention.
Admission must reserve compute allowance including retry attempts. Concurrency
alone is not a spending cap. SQS visibility timeout must exceed execution time.

Illustrative compute: 1,000 total executions/month × 30 seconds × 2 GB ×
$0.0000166667/GB-second ≈ $1 before free allowances, plus queue, request, storage
and log charges. The $0–2 worker allowance assumes this small workload and
includes retry executions in the 1,000. Sustained research runs are a separate
budget. Split large work into deterministic resumable chunks: standard Lambda
has a 15-minute invocation limit. API clients need a documented asynchronous
job contract and polling updates; do not silently break existing bot scripts.
Sources: [Lambda pricing](https://aws.amazon.com/lambda/pricing/),
[Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html),
[SQS pricing](https://aws.amazon.com/sqs/pricing/).

Reuse Atlas instead of buying a second cluster by default. Verify the actual
tier supports required transactions, indexes, retention and workload before
committing to the estimate. Inventory acceptance must prove balance, purchase
idempotency and ledger consistency across failure/retry, not just persistence.
Keep real payments disabled until that acceptance passes. Implement and test
async sessions first; production activation remains conditional on the ranked/
multi-device need stated in the roadmap, not user count alone.

If this is Atlas Flex, published pricing is approximately $8–30 per 30 days
according to operation rate, with 5 GB included. The reported $12 does not prove
the tier or its cause. The $0–2 DB allowance assumes added traffic stays near
current billing; at the published $30 Flex ceiling the total estimate would be
about $60–66 instead. No upgrade or downgrade is proposed without checking
capabilities, usage and recovery needs. [Atlas Flex costs](https://www.mongodb.com/docs/atlas/billing/atlas-flex-costs/),
[Flex limitations](https://www.mongodb.com/docs/atlas/reference/flex-limitations/).

For ops, persist infrequently changed configuration in Atlas. Emit bounded
structured telemetry through the existing log path, then build a scheduled
aggregate with an explicit watermark, missing-data state and duplicate-event
handling. Price its measured log volume and query scan bytes before activation.
Never depend on periodic in-memory flushes surviving Amplify instance shutdown.
The $0–2 allowance assumes low-volume selected-route events, bounded retention,
no new monitoring subscription, and infrequent aggregation. Avoid full-table
scans or database writes for every gameplay move. The UI must show data age and
scope and must not present missing events as zero activity.

## Execution order and budget review

1. Reconcile the invoices and prepare infrastructure/code locally.
2. After explicit cost approval, provision dev and run isolated WAF acceptance.
3. Deploy and measure bounded workers.
4. Complete transactional inventory and async sessions in dev; activate only
   the accepted production features and measure Atlas operation changes.
5. Add shared ops data and the console, then run final V1 acceptance.

Proposed operating target: $50/month total, split approximately $36 AWS and $14
MongoDB, with the $5–10 temporary acceptance exercise tracked separately. These
are review thresholds, not enforced provider billing limits. Existing services
can continue accruing charges after an alert. Pause new optional batch jobs if
their measured usage exceeds the agreed allowance; preserve gameplay and data.

Leave NAT, PrivateLink, always-on workers, a second paid DB cluster, and paid
analytics outside this proposal. For scale, one NAT at $0.045/hour plus one
public IPv4 address at $0.005/hour is $36.50 per 730-hour month before compute
or data processing. That alone nearly doubles today's baseline. Fixed egress
already belongs to V2. [VPC pricing](https://aws.amazon.com/vpc/pricing/)

## Open evidence needed

- AWS invoice by service and usage type, region, credits and tax treatment.
- Atlas tier, usage breakdown, storage/index footprint and backup capabilities.
- Actual dev build cadence, worker duration/memory measurements and expected job count.
- Required ops freshness and measured log/query volume.

No infrastructure was provisioned, metered feature enabled, payment activated,
or roadmap checkbox changed while preparing this proposal.
