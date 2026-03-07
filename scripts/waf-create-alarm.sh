#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

AWS_REGION="${AWS_REGION:-us-east-1}"
WEB_ACL_NAME="${WEB_ACL_NAME:-binary2048-web-acl}"
ALARM_NAME="${ALARM_NAME:-WAFBlockedRequestsHigh}"
THRESHOLD="${THRESHOLD:-500}"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:-}"

TEMPLATE="${ROOT_DIR}/docs/waf-blocked-requests-alarm-template.json"
TMP_JSON="$(mktemp)"
cp "${TEMPLATE}" "${TMP_JSON}"

sed -i.bak "s/\"AlarmName\": \"[^\"]*\"/\"AlarmName\": \"${ALARM_NAME}\"/" "${TMP_JSON}"
sed -i.bak "s/\"Value\": \"binary2048-web-acl\"/\"Value\": \"${WEB_ACL_NAME}\"/" "${TMP_JSON}"
sed -i.bak "s/\"Threshold\": [0-9]*/\"Threshold\": ${THRESHOLD}/" "${TMP_JSON}"
rm -f "${TMP_JSON}.bak"

echo "==> Creating/updating CloudWatch alarm ${ALARM_NAME}"
if [[ -n "${SNS_TOPIC_ARN}" ]]; then
  aws cloudwatch put-metric-alarm \
    --region "${AWS_REGION}" \
    --cli-input-json "file://${TMP_JSON}" \
    --alarm-actions "${SNS_TOPIC_ARN}"
else
  aws cloudwatch put-metric-alarm \
    --region "${AWS_REGION}" \
    --cli-input-json "file://${TMP_JSON}"
fi

rm -f "${TMP_JSON}"
echo "==> Done"
