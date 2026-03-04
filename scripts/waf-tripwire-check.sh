#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
BUDGET_NAME="${BUDGET_NAME:-binary2048-monthly-cost}"
ALARM_NAME="${ALARM_NAME:-WAFBlockedRequestsHigh}"
EXPECTED_THRESHOLDS="${EXPECTED_THRESHOLDS:-50 80 100}"
REQUIRE_ALARM_ACTIONS="${REQUIRE_ALARM_ACTIONS:-0}"

PASS=0
FAIL=0

ok() {
  PASS=$((PASS + 1))
  echo "PASS: $1"
}

bad() {
  FAIL=$((FAIL + 1))
  echo "FAIL: $1"
}

if aws budgets describe-budget \
  --account-id "${ACCOUNT_ID}" \
  --budget-name "${BUDGET_NAME}" >/dev/null 2>&1; then
  ok "Budget exists: ${BUDGET_NAME}"
else
  bad "Budget not found: ${BUDGET_NAME}"
fi

for threshold in ${EXPECTED_THRESHOLDS}; do
  COUNT="$(
    aws budgets describe-notifications-for-budget \
      --account-id "${ACCOUNT_ID}" \
      --budget-name "${BUDGET_NAME}" \
      --query "length(Notifications[?Threshold==\`${threshold}\` && NotificationType=='ACTUAL' && ComparisonOperator=='GREATER_THAN' && ThresholdType=='PERCENTAGE'])" \
      --output text 2>/dev/null || echo "0"
  )"
  if [[ "${COUNT}" == "1" ]]; then
    ok "Budget notification threshold exists: ${threshold}%"
  else
    bad "Budget notification threshold missing: ${threshold}%"
  fi
done

ALARM_COUNT="$(
  aws cloudwatch describe-alarms \
    --region "${AWS_REGION}" \
    --alarm-names "${ALARM_NAME}" \
    --query "length(MetricAlarms)" \
    --output text
)"
if [[ "${ALARM_COUNT}" == "1" ]]; then
  ok "CloudWatch alarm exists: ${ALARM_NAME}"
else
  bad "CloudWatch alarm not found: ${ALARM_NAME}"
fi

if [[ "${REQUIRE_ALARM_ACTIONS}" == "1" ]]; then
  ACTION_COUNT="$(
    aws cloudwatch describe-alarms \
      --region "${AWS_REGION}" \
      --alarm-names "${ALARM_NAME}" \
      --query "length(MetricAlarms[0].AlarmActions)" \
      --output text 2>/dev/null || echo "0"
  )"
  if [[ "${ACTION_COUNT}" =~ ^[0-9]+$ && "${ACTION_COUNT}" -gt 0 ]]; then
    ok "CloudWatch alarm actions configured: ${ALARM_NAME}"
  else
    bad "CloudWatch alarm actions missing: ${ALARM_NAME}"
  fi
fi

echo "Summary: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi
