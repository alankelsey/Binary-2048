#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ACCOUNT_ID="${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
BUDGET_NAME="${BUDGET_NAME:-binary2048-monthly-cost}"
BUDGET_AMOUNT_USD="${BUDGET_AMOUNT_USD:-50}"
BUDGET_EMAIL="${BUDGET_EMAIL:-}"
NOTIFICATION_THRESHOLDS="${NOTIFICATION_THRESHOLDS:-50 80 100}"

if [[ -z "${BUDGET_EMAIL}" ]]; then
  echo "error: BUDGET_EMAIL is required (alert destination)" >&2
  echo "usage: BUDGET_EMAIL=you@example.com npm run ops:waf:budget" >&2
  exit 1
fi

budget_exists() {
  aws budgets describe-budget \
    --account-id "${ACCOUNT_ID}" \
    --budget-name "${BUDGET_NAME}" >/dev/null 2>&1
}

build_notification_json() {
  local threshold="$1"
  cat <<JSON
{
  "NotificationType": "ACTUAL",
  "ComparisonOperator": "GREATER_THAN",
  "Threshold": ${threshold},
  "ThresholdType": "PERCENTAGE"
}
JSON
}

build_subscribers_json() {
  cat <<JSON
[
  {
    "SubscriptionType": "EMAIL",
    "Address": "${BUDGET_EMAIL}"
  }
]
JSON
}

ensure_notification() {
  local threshold="$1"
  local notification_json
  local subscribers_json
  notification_json="$(build_notification_json "${threshold}")"
  subscribers_json="$(build_subscribers_json)"

  if aws budgets describe-notifications-for-budget \
    --account-id "${ACCOUNT_ID}" \
    --budget-name "${BUDGET_NAME}" \
    --query "length(Notifications[?Threshold==\`${threshold}\` && NotificationType=='ACTUAL' && ComparisonOperator=='GREATER_THAN' && ThresholdType=='PERCENTAGE'])" \
    --output text | grep -q '^1$'; then
    aws budgets delete-notification \
      --account-id "${ACCOUNT_ID}" \
      --budget-name "${BUDGET_NAME}" \
      --notification "${notification_json}" >/dev/null
  fi
  aws budgets create-notification \
    --account-id "${ACCOUNT_ID}" \
    --budget-name "${BUDGET_NAME}" \
    --notification "${notification_json}" \
    --subscribers "${subscribers_json}" >/dev/null
  echo "==> Upserted budget notification threshold=${threshold}%"
}

TEMPLATE="${ROOT_DIR}/docs/aws-budget-template.json"
TMP_JSON="$(mktemp)"
TMP_BUDGET_JSON="$(mktemp)"
cp "${TEMPLATE}" "${TMP_JSON}"

sed -i.bak "s/\"BudgetName\": \"[^\"]*\"/\"BudgetName\": \"${BUDGET_NAME}\"/" "${TMP_JSON}"
sed -i.bak "s/\"Amount\": \"[^\"]*\"/\"Amount\": \"${BUDGET_AMOUNT_USD}\"/" "${TMP_JSON}"
sed -i.bak "s/\"Address\": \"[^\"]*\"/\"Address\": \"${BUDGET_EMAIL}\"/g" "${TMP_JSON}"
rm -f "${TMP_JSON}.bak"

cat >"${TMP_BUDGET_JSON}" <<JSON
{
  "BudgetName": "${BUDGET_NAME}",
  "BudgetLimit": {
    "Amount": "${BUDGET_AMOUNT_USD}",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
JSON

if budget_exists; then
  echo "==> Updating AWS Budget '${BUDGET_NAME}' for account ${ACCOUNT_ID}"
  aws budgets update-budget \
    --account-id "${ACCOUNT_ID}" \
    --new-budget "file://${TMP_BUDGET_JSON}" >/dev/null
else
  echo "==> Creating AWS Budget '${BUDGET_NAME}' for account ${ACCOUNT_ID}"
  aws budgets create-budget \
    --account-id "${ACCOUNT_ID}" \
    --cli-input-json "file://${TMP_JSON}" >/dev/null
fi

for threshold in ${NOTIFICATION_THRESHOLDS}; do
  ensure_notification "${threshold}"
done

rm -f "${TMP_JSON}"
rm -f "${TMP_BUDGET_JSON}"
echo "==> Done"
