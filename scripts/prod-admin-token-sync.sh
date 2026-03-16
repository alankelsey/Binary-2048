#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-dzxvs1esr22z9}"
BRANCH_NAME="${BRANCH_NAME:-main}"
AWS_REGION="${AWS_REGION:-us-east-2}"
PROD_BASE="${PROD_BASE:-https://www.binary2048.com}"
ADMIN_TOKEN="${BINARY2048_ADMIN_TOKEN:-${ADMIN_TOKEN:-}}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required." >&2
  exit 1
fi

if [[ -z "${ADMIN_TOKEN}" ]]; then
  ADMIN_TOKEN="$(openssl rand -hex 32)"
fi

CURRENT="$(
  aws amplify get-branch \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH_NAME}" \
    --region "${AWS_REGION}" \
    --query 'branch.environmentVariables' \
    --output json
)"

UPDATED="$(printf '%s' "${CURRENT}" | jq \
  --arg admin_token "${ADMIN_TOKEN}" \
  '. + { "BINARY2048_ADMIN_TOKEN": $admin_token }')"

echo "Updating Amplify branch admin token..."
aws amplify update-branch \
  --app-id "${APP_ID}" \
  --branch-name "${BRANCH_NAME}" \
  --region "${AWS_REGION}" \
  --environment-variables "${UPDATED}" \
  >/dev/null

echo "Starting Amplify release job..."
aws amplify start-job \
  --app-id "${APP_ID}" \
  --branch-name "${BRANCH_NAME}" \
  --job-type RELEASE \
  --region "${AWS_REGION}" \
  >/dev/null

echo "Waiting for deploy..."
APP_ID="${APP_ID}" BRANCH_NAME="${BRANCH_NAME}" AWS_REGION="${AWS_REGION}" npm run -s ops:amplify:watch

echo "Verifying production storage health..."
PROD_BASE="${PROD_BASE}" BINARY2048_ADMIN_TOKEN="${ADMIN_TOKEN}" npm run -s ops:prod:storage-check

echo
echo "Admin token synced."
echo "BINARY2048_ADMIN_TOKEN=${ADMIN_TOKEN}"
