# AWS WAF Apply Runbook (Amplify + CloudFront)

This runbook applies the baseline template in this repo.

## Prerequisites
- AWS CLI v2 configured with permissions for WAFv2, CloudFront, CloudWatch, Budgets, SNS.
- Region notes:
  - WAF for CloudFront uses `us-east-1` APIs.
  - Budgets are account-global (use your preferred billing region profile settings).

## 0) Fast path (scripted setup)

```bash
DIST_ID=E123ABC456XYZ \
LOG_GROUP_NAME=aws-waf-logs-binary2048 \
npm run ops:waf:setup
```

Script path: `scripts/waf-setup.sh`

Companion scripts:
- `npm run ops:waf:status` (association + rules + rate-limit + logging snapshot)
- `npm run ops:waf:verify` (check current association)
- `npm run ops:waf:rollback` (remove WAF association)
- `npm run ops:waf:alarm` (create/update blocked-requests alarm)

Quick status check:

```bash
DIST_ID=E123ABC456XYZ npm run ops:waf:status
```

## 1) Find your Amplify-backed CloudFront distribution

```bash
aws cloudfront list-distributions \
  --query "DistributionList.Items[].[Id,DomainName,Comment]" \
  --output table
```

Copy your distribution ID and ARN.

## 2) Create the Web ACL from template

```bash
aws wafv2 create-web-acl \
  --region us-east-1 \
  --cli-input-json file://docs/waf-web-acl-template.json
```

Capture:
- `Summary.ARN`
- `Summary.Id`
- `Summary.Name`

## 3) Associate Web ACL with CloudFront distribution

```bash
WEB_ACL_ARN="arn:aws:wafv2:us-east-1:123456789012:global/webacl/binary2048-web-acl/xxxx"
DIST_ARN="arn:aws:cloudfront::123456789012:distribution/E123ABC456XYZ"

aws wafv2 associate-web-acl \
  --region us-east-1 \
  --web-acl-arn "$WEB_ACL_ARN" \
  --resource-arn "$DIST_ARN"
```

Verify:

```bash
aws wafv2 get-web-acl-for-resource \
  --region us-east-1 \
  --resource-arn "$DIST_ARN"
```

## 4) Enable WAF logging

Create a CloudWatch log group first (example):

```bash
aws logs create-log-group \
  --region us-east-1 \
  --log-group-name aws-waf-logs-binary2048
```

Then enable logging:

```bash
aws wafv2 put-logging-configuration \
  --region us-east-1 \
  --logging-configuration '{
    "ResourceArn": "'"$WEB_ACL_ARN"'",
    "LogDestinationConfigs": [
      "arn:aws:logs:us-east-1:123456789012:log-group:aws-waf-logs-binary2048"
    ]
  }'
```

## 5) Create baseline CloudWatch alarms

Recommended alarms:
- `WAFBlockedRequestsHigh`
- `WAFAllowedRequestsAnomaly`

Example blocked-requests alarm:

```bash
WEB_ACL_NAME=binary2048-web-acl \
ALARM_NAME=WAFBlockedRequestsHigh \
THRESHOLD=500 \
npm run ops:waf:alarm
```

## 6) Billing tripwire (SNS + Budget)

Create SNS topic and subscription:

```bash
aws sns create-topic --name binary2048-billing-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:binary2048-billing-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

Create a monthly cost budget with 50/80/100 notifications (use AWS Console or JSON-based `create-budget`).

Template path: `docs/aws-budget-template.json`

```bash
aws budgets create-budget \
  --account-id 123456789012 \
  --cli-input-json file://docs/aws-budget-template.json
```

## 7) Route 53 abuse visibility

- Enable Route 53 query logging for hosted zones.
- Alarm on NXDOMAIN spikes and sudden query surges.
- Avoid wildcard DNS (`*.binary2048.com`) unless strictly required.

## 8) Rollout strategy
- Day 0: deploy managed rules + rate limits.
- Day 1-3: inspect WAF logs for false positives.
- Day 4+: tune `RateLimitApi` and stricter path-specific rules.

## 9) Rollback

Disassociate Web ACL if emergency false positives occur:

```bash
DIST_ID=E123ABC456XYZ npm run ops:waf:rollback
```
