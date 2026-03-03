#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
BUDGET_NAME="${BUDGET_NAME:-binary2048-monthly-cost}"
ALARM_NAME="${ALARM_NAME:-WAFBlockedRequestsHigh}"

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

echo "Summary: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi
