#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ACCOUNT_ID="${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
BUDGET_NAME="${BUDGET_NAME:-binary2048-monthly-cost}"
BUDGET_AMOUNT_USD="${BUDGET_AMOUNT_USD:-50}"
BUDGET_EMAIL="${BUDGET_EMAIL:-}"

if [[ -z "${BUDGET_EMAIL}" ]]; then
  echo "error: BUDGET_EMAIL is required (alert destination)" >&2
  echo "usage: BUDGET_EMAIL=you@example.com npm run ops:waf:budget" >&2
  exit 1
fi

if aws budgets describe-budget \
  --account-id "${ACCOUNT_ID}" \
  --budget-name "${BUDGET_NAME}" >/dev/null 2>&1; then
  echo "Budget '${BUDGET_NAME}' already exists for account ${ACCOUNT_ID}. Skipping create."
  echo "If you want a new one, set a different BUDGET_NAME."
  exit 0
fi

TEMPLATE="${ROOT_DIR}/docs/aws-budget-template.json"
TMP_JSON="$(mktemp)"
cp "${TEMPLATE}" "${TMP_JSON}"

sed -i.bak "s/\"BudgetName\": \"[^\"]*\"/\"BudgetName\": \"${BUDGET_NAME}\"/" "${TMP_JSON}"
sed -i.bak "s/\"Amount\": \"[^\"]*\"/\"Amount\": \"${BUDGET_AMOUNT_USD}\"/" "${TMP_JSON}"
sed -i.bak "s/\"Address\": \"[^\"]*\"/\"Address\": \"${BUDGET_EMAIL}\"/g" "${TMP_JSON}"
rm -f "${TMP_JSON}.bak"

echo "==> Creating AWS Budget '${BUDGET_NAME}' for account ${ACCOUNT_ID}"
aws budgets create-budget \
  --account-id "${ACCOUNT_ID}" \
  --cli-input-json "file://${TMP_JSON}"

rm -f "${TMP_JSON}"
echo "==> Done"
