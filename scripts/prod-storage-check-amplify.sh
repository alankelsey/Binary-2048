#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-dzxvs1esr22z9}"
BRANCH_NAME="${BRANCH_NAME:-main}"
AWS_REGION="${AWS_REGION:-us-east-2}"
PROD_BASE="${PROD_BASE:-https://www.binary2048.com}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi

TOKEN="$(
  aws amplify get-branch \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH_NAME}" \
    --region "${AWS_REGION}" \
    --query 'branch.environmentVariables.BINARY2048_ADMIN_TOKEN' \
    --output text
)"

if [[ -z "${TOKEN}" || "${TOKEN}" == "None" ]]; then
  echo "prod storage check failed: BINARY2048_ADMIN_TOKEN not found in Amplify branch env" >&2
  echo "app=${APP_ID} branch=${BRANCH_NAME} region=${AWS_REGION}" >&2
  echo "Run: APP_ID=${APP_ID} BRANCH_NAME=${BRANCH_NAME} AWS_REGION=${AWS_REGION} PROD_BASE=${PROD_BASE} npm run ops:prod:admin-token:sync" >&2
  exit 1
fi

BINARY2048_ADMIN_TOKEN="${TOKEN}" PROD_BASE="${PROD_BASE}" npm run -s ops:prod:storage-check
