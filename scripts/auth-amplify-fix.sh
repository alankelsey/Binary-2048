#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-dzxvs1esr22z9}"
REGION="${REGION:-us-east-2}"
BRANCH_NAME="${BRANCH_NAME:-main}"
PROD_BASE="${PROD_BASE:-https://www.binary2048.com}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
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

echo "Amplify auth fix"
echo "app_id=${APP_ID} branch=${BRANCH_NAME} region=${REGION} base=${PROD_BASE}"

if [[ -z "${AUTH_GITHUB_ID:-}" ]]; then
  read -r -p "Enter GitHub OAuth Client ID (AUTH_GITHUB_ID): " AUTH_GITHUB_ID
fi

if [[ -z "${AUTH_GITHUB_SECRET:-}" ]]; then
  read -r -s -p "Enter GitHub OAuth Client Secret (AUTH_GITHUB_SECRET): " AUTH_GITHUB_SECRET
  echo
fi

if [[ -z "${AUTH_GITHUB_ID:-}" || -z "${AUTH_GITHUB_SECRET:-}" ]]; then
  echo "AUTH_GITHUB_ID and AUTH_GITHUB_SECRET are required." >&2
  exit 1
fi

if [[ "${AUTH_GITHUB_ID}" == *"<"* || "${AUTH_GITHUB_ID}" == *">"* || "${AUTH_GITHUB_SECRET}" == *"<"* || "${AUTH_GITHUB_SECRET}" == *">"* ]]; then
  echo "Detected placeholder-style OAuth values. Use real GitHub OAuth credentials." >&2
  exit 1
fi

AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -hex 32)}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-${AUTH_SECRET}}"
NEXTAUTH_URL="${NEXTAUTH_URL:-${PROD_BASE}}"

echo "Updating Amplify branch environment variables..."
aws amplify update-branch \
  --app-id "${APP_ID}" \
  --branch-name "${BRANCH_NAME}" \
  --region "${REGION}" \
  --environment-variables "AUTH_SECRET=${AUTH_SECRET},NEXTAUTH_SECRET=${NEXTAUTH_SECRET},NEXTAUTH_URL=${NEXTAUTH_URL},AUTH_GITHUB_ID=${AUTH_GITHUB_ID},AUTH_GITHUB_SECRET=${AUTH_GITHUB_SECRET}" \
  >/dev/null

echo "Starting Amplify RELEASE job..."
aws amplify start-job \
  --app-id "${APP_ID}" \
  --branch-name "${BRANCH_NAME}" \
  --job-type RELEASE \
  --region "${REGION}" \
  >/dev/null

echo "Waiting for deploy completion..."
APP_ID="${APP_ID}" BRANCH_NAME="${BRANCH_NAME}" AWS_REGION="${REGION}" npm run -s ops:amplify:watch

echo "Running auth/session release check..."
PROD_BASE="${PROD_BASE}" npm run -s ops:release:auth-check

echo "Auth fix flow complete."
