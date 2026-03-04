# Route 53 NXDOMAIN Runbook

## Goal

Detect DNS abuse patterns (NXDOMAIN spikes/subdomain probing) by turning Route 53 query logs into CloudWatch metrics and alarms.

## Prerequisites

- Route 53 query logging enabled for the hosted zone.
- CloudWatch log group receiving Route 53 query logs.
- AWS CLI configured with permissions for:
  - `logs:PutMetricFilter`
  - `cloudwatch:PutMetricAlarm`

## One-command setup

```bash
QUERY_LOG_GROUP_NAME=/aws/route53/your-zone \
AWS_REGION=us-east-1 \
THRESHOLD=200 \
npm run ops:waf:nxdomain
```

Optional:

- `SNS_TOPIC_ARN=arn:aws:sns:...` to attach alarm actions.
- `PERIOD_SECONDS` (default `300`)
- `EVALUATION_PERIODS` (default `1`)
- `ALARM_NAME` override.

## What it configures

1. CloudWatch metric filter:
   - Pattern: `{ $.rcode = "NXDOMAIN" }`
   - Metric: `Binary2048/Route53` / `NXDomainCount` (defaults)
2. CloudWatch alarm on metric sum threshold.

## Verification

1. Confirm filter exists:
   - `aws logs describe-metric-filters --log-group-name <group>`
2. Confirm alarm exists:
   - `aws cloudwatch describe-alarms --alarm-names Route53NXDomainSpike`
3. Generate test NXDOMAIN queries (non-production domain/hostnames) and verify metric increments.

## Incident Response Notes

- If alarm fires:
  - Check WAF and app telemetry (`/api/ops/telemetry`) for correlated spikes.
  - Verify no wildcard DNS records are unintentionally broad.
  - Consider temporary stricter WAF rate limits for suspicious source patterns.

