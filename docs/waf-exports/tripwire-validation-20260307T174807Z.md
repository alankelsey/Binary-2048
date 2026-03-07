# Billing Tripwire Validation Evidence

- Timestamp (UTC): 20260307T174807Z
- Account: 750629424234
- Region: us-east-1
- Budget: binary2048-monthly-cost
- Alarm: WAFBlockedRequestsHigh
- SNS Topic: arn:aws:sns:us-east-1:750629424234:binary2048-billing-alerts

## Budget checks
- Budget exists: yes
- Threshold 50% notification count: 1
- Threshold 80% notification count: 1
- Threshold 100% notification count: 1

## Alarm checks
- Alarm exists: 1
- Alarm action count: 1
- Forced state after ALARM set: ALARM
- State after reset to OK: OK

## SNS test publish
- MessageId: f3521417-76ab-54bc-aebb-7631118fd20a

## Artifact JSON
- docs/waf-exports/tripwire-validation-20260307T174807Z.json
