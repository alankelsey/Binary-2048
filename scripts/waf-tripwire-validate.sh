#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
BUDGET_NAME="${BUDGET_NAME:-binary2048-monthly-cost}"
ALARM_NAME="${ALARM_NAME:-WAFBlockedRequestsHigh}"
TOPIC_NAME="${TOPIC_NAME:-binary2048-billing-alerts}"
FORCE_ALARM="${FORCE_ALARM:-1}"
PUBLISH_SNS_TEST="${PUBLISH_SNS_TEST:-1}"
OUTPUT_DIR="${OUTPUT_DIR:-${ROOT_DIR}/docs/waf-exports}"

mkdir -p "${OUTPUT_DIR}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
MD_OUT="${OUTPUT_DIR}/tripwire-validation-${STAMP}.md"
JSON_OUT="${OUTPUT_DIR}/tripwire-validation-${STAMP}.json"

echo "==> Validating billing tripwire (region=${AWS_REGION}, account=${ACCOUNT_ID})"

TOPIC_ARN="$(
  aws sns create-topic \
    --region "${AWS_REGION}" \
    --name "${TOPIC_NAME}" \
    --query "TopicArn" \
    --output text
)"

BUDGET_EXISTS="$(
  aws budgets describe-budget \
    --account-id "${ACCOUNT_ID}" \
    --budget-name "${BUDGET_NAME}" \
    --query "Budget.BudgetName" \
    --output text 2>/dev/null || true
)"
BUDGET_EXISTS_BOOL="false"
if [[ -n "${BUDGET_EXISTS}" && "${BUDGET_EXISTS}" != "None" ]]; then
  BUDGET_EXISTS_BOOL="true"
fi

NOTIFICATION_THRESHOLDS_RAW="$(
  aws budgets describe-notifications-for-budget \
    --account-id "${ACCOUNT_ID}" \
    --budget-name "${BUDGET_NAME}" \
    --query "Notifications[?NotificationType=='ACTUAL' && ComparisonOperator=='GREATER_THAN'].Threshold" \
    --output text 2>/dev/null || true
)"
THRESHOLD_50="0"
THRESHOLD_80="0"
THRESHOLD_100="0"
if echo "${NOTIFICATION_THRESHOLDS_RAW}" | tr '\t' '\n' | grep -Eq '^50(\.0+)?$'; then THRESHOLD_50="1"; fi
if echo "${NOTIFICATION_THRESHOLDS_RAW}" | tr '\t' '\n' | grep -Eq '^80(\.0+)?$'; then THRESHOLD_80="1"; fi
if echo "${NOTIFICATION_THRESHOLDS_RAW}" | tr '\t' '\n' | grep -Eq '^100(\.0+)?$'; then THRESHOLD_100="1"; fi

ALARM_EXISTS="$(
  aws cloudwatch describe-alarms \
    --region "${AWS_REGION}" \
    --alarm-names "${ALARM_NAME}" \
    --query "length(MetricAlarms)" \
    --output text
)"

ALARM_ACTIONS="$(
  aws cloudwatch describe-alarms \
    --region "${AWS_REGION}" \
    --alarm-names "${ALARM_NAME}" \
    --query "length(MetricAlarms[0].AlarmActions)" \
    --output text 2>/dev/null || echo "0"
)"

STATE_AFTER_ALARM="not-run"
STATE_AFTER_OK="not-run"

if [[ "${FORCE_ALARM}" == "1" && "${ALARM_EXISTS}" == "1" ]]; then
  echo "==> Forcing CloudWatch alarm to ALARM for validation"
  aws cloudwatch set-alarm-state \
    --region "${AWS_REGION}" \
    --alarm-name "${ALARM_NAME}" \
    --state-value ALARM \
    --state-reason "Binary-2048 tripwire forced validation (${STAMP})" >/dev/null
  sleep 2
  STATE_AFTER_ALARM="$(
    aws cloudwatch describe-alarms \
      --region "${AWS_REGION}" \
      --alarm-names "${ALARM_NAME}" \
      --query "MetricAlarms[0].StateValue" \
      --output text
  )"

  echo "==> Resetting CloudWatch alarm to OK"
  aws cloudwatch set-alarm-state \
    --region "${AWS_REGION}" \
    --alarm-name "${ALARM_NAME}" \
    --state-value OK \
    --state-reason "Binary-2048 tripwire validation reset (${STAMP})" >/dev/null
  sleep 2
  STATE_AFTER_OK="$(
    aws cloudwatch describe-alarms \
      --region "${AWS_REGION}" \
      --alarm-names "${ALARM_NAME}" \
      --query "MetricAlarms[0].StateValue" \
      --output text
  )"
fi

SNS_MESSAGE_ID="not-run"
if [[ "${PUBLISH_SNS_TEST}" == "1" ]]; then
  echo "==> Publishing SNS tripwire test message"
  SNS_MESSAGE_ID="$(
    aws sns publish \
      --region "${AWS_REGION}" \
      --topic-arn "${TOPIC_ARN}" \
      --subject "Binary-2048 Billing Tripwire Test" \
      --message "Tripwire validation test at ${STAMP} (alarm=${ALARM_NAME}, budget=${BUDGET_NAME})" \
      --query "MessageId" \
      --output text
  )"
fi

cat >"${JSON_OUT}" <<JSON
{
  "generatedAtUtc": "${STAMP}",
  "accountId": "${ACCOUNT_ID}",
  "region": "${AWS_REGION}",
  "budgetName": "${BUDGET_NAME}",
  "budgetExists": ${BUDGET_EXISTS_BOOL},
  "budgetThresholds": {
    "50": ${THRESHOLD_50},
    "80": ${THRESHOLD_80},
    "100": ${THRESHOLD_100}
  },
  "alarmName": "${ALARM_NAME}",
  "alarmExists": ${ALARM_EXISTS},
  "alarmActionsCount": ${ALARM_ACTIONS},
  "forcedAlarm": {
    "enabled": ${FORCE_ALARM},
    "stateAfterAlarm": "${STATE_AFTER_ALARM}",
    "stateAfterOk": "${STATE_AFTER_OK}"
  },
  "sns": {
    "topicName": "${TOPIC_NAME}",
    "topicArn": "${TOPIC_ARN}",
    "testPublishEnabled": ${PUBLISH_SNS_TEST},
    "messageId": "${SNS_MESSAGE_ID}"
  }
}
JSON

{
  echo "# Billing Tripwire Validation Evidence"
  echo
  echo "- Timestamp (UTC): ${STAMP}"
  echo "- Account: ${ACCOUNT_ID}"
  echo "- Region: ${AWS_REGION}"
  echo "- Budget: ${BUDGET_NAME}"
  echo "- Alarm: ${ALARM_NAME}"
  echo "- SNS Topic: ${TOPIC_ARN}"
  echo
  echo "## Budget checks"
  if [[ -n "${BUDGET_EXISTS}" && "${BUDGET_EXISTS}" != "None" ]]; then
    echo "- Budget exists: yes"
  else
    echo "- Budget exists: no"
  fi
  echo "- Threshold 50% notification count: ${THRESHOLD_50}"
  echo "- Threshold 80% notification count: ${THRESHOLD_80}"
  echo "- Threshold 100% notification count: ${THRESHOLD_100}"
  echo
  echo "## Alarm checks"
  echo "- Alarm exists: ${ALARM_EXISTS}"
  echo "- Alarm action count: ${ALARM_ACTIONS}"
  echo "- Forced state after ALARM set: ${STATE_AFTER_ALARM}"
  echo "- State after reset to OK: ${STATE_AFTER_OK}"
  echo
  echo "## SNS test publish"
  echo "- MessageId: ${SNS_MESSAGE_ID}"
  echo
  echo "## Artifact JSON"
  echo "- ${JSON_OUT#${ROOT_DIR}/}"
} >"${MD_OUT}"

echo "Evidence written:"
echo "- ${MD_OUT}"
echo "- ${JSON_OUT}"

# Hard pass/fail gates for automation
if [[ -z "${BUDGET_EXISTS}" || "${BUDGET_EXISTS}" == "None" ]]; then
  echo "error: budget missing (${BUDGET_NAME})" >&2
  exit 1
fi
if [[ "${THRESHOLD_50}" == "0" || "${THRESHOLD_80}" == "0" || "${THRESHOLD_100}" == "0" ]]; then
  echo "error: one or more required budget thresholds missing (50/80/100)" >&2
  exit 1
fi
if [[ "${ALARM_EXISTS}" != "1" ]]; then
  echo "error: alarm missing (${ALARM_NAME})" >&2
  exit 1
fi
if [[ "${FORCE_ALARM}" == "1" && "${STATE_AFTER_ALARM}" != "ALARM" ]]; then
  echo "error: forced alarm state validation failed" >&2
  exit 1
fi
if [[ "${FORCE_ALARM}" == "1" && "${STATE_AFTER_OK}" != "OK" ]]; then
  echo "error: alarm reset to OK failed" >&2
  exit 1
fi
if [[ "${PUBLISH_SNS_TEST}" == "1" && ( -z "${SNS_MESSAGE_ID}" || "${SNS_MESSAGE_ID}" == "None" ) ]]; then
  echo "error: SNS test publish failed" >&2
  exit 1
fi

echo "Tripwire validation PASSED"
