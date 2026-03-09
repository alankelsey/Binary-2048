#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-dzxvs1esr22z9}"
BRANCH_NAME="${BRANCH_NAME:-main}"
AWS_REGION="${AWS_REGION:-us-east-2}"
PROD_BASE="${PROD_BASE:-https://www.binary2048.com}"
AMPLIFY_DOMAIN_BASE="${AMPLIFY_DOMAIN_BASE:-https://main.dzxvs1esr22z9.amplifyapp.com}"

MONGO_URI="${MONGO_URI:-}"
S3_BUCKET="${S3_BUCKET:-}"
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

if [[ -z "${MONGO_URI}" ]]; then
  echo "MONGO_URI is required." >&2
  exit 1
fi
if [[ -z "${S3_BUCKET}" ]]; then
  echo "S3_BUCKET is required." >&2
  exit 1
fi
if [[ "${MONGO_URI}" == *"<"* || "${MONGO_URI}" == *">"* ]]; then
  echo "MONGO_URI contains placeholder-style values. Use a real Atlas URI." >&2
  exit 1
fi
if [[ "${S3_BUCKET}" == *"<"* || "${S3_BUCKET}" == *">"* ]]; then
  echo "S3_BUCKET contains placeholder-style values. Use a real bucket name." >&2
  exit 1
fi

if [[ -z "${ADMIN_TOKEN}" ]]; then
  ADMIN_TOKEN="$(openssl rand -hex 32)"
fi

echo "storage rollout"
echo "  app=${APP_ID}"
echo "  branch=${BRANCH_NAME}"
echo "  region=${AWS_REGION}"
echo "  prod=${PROD_BASE}"
echo "  amplify_domain=${AMPLIFY_DOMAIN_BASE}"
echo "  s3_bucket=${S3_BUCKET}"

CURRENT="$(aws amplify get-branch \
  --app-id "${APP_ID}" \
  --branch-name "${BRANCH_NAME}" \
  --region "${AWS_REGION}" \
  --query 'branch.environmentVariables' \
  --output json)"

UPDATED="$(printf '%s' "${CURRENT}" | jq \
  --arg mongo_uri "${MONGO_URI}" \
  --arg s3_bucket "${S3_BUCKET}" \
  --arg admin_token "${ADMIN_TOKEN}" \
  '. + {
    "BINARY2048_RUN_STORE":"mongo",
    "BINARY2048_SESSION_STORE":"mongo",
    "BINARY2048_MONGO_URI":$mongo_uri,
    "BINARY2048_MONGO_DB":"binary2048",
    "BINARY2048_MONGO_RUN_COLLECTION":"runs",
    "BINARY2048_MONGO_SESSION_COLLECTION":"sessions",
    "BINARY2048_REPLAY_ARTIFACT_STORE":"s3",
    "BINARY2048_REPLAY_S3_BUCKET":$s3_bucket,
    "BINARY2048_REPLAY_S3_REGION":"us-east-2",
    "BINARY2048_REPLAY_S3_PREFIX":"replays",
    "BINARY2048_REPLAY_S3_MIN_SCORE":"2048",
    "BINARY2048_REPLAY_S3_CONTEST_ONLY":"false",
    "BINARY2048_ADMIN_TOKEN":$admin_token
  }')"

echo "Updating Amplify branch env..."
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

echo "Verifying storage health on amplify domain..."
PROD_BASE="${AMPLIFY_DOMAIN_BASE}" BINARY2048_ADMIN_TOKEN="${ADMIN_TOKEN}" npm run -s ops:prod:storage-check

echo "Verifying storage health on custom domain..."
PROD_BASE="${PROD_BASE}" BINARY2048_ADMIN_TOKEN="${ADMIN_TOKEN}" npm run -s ops:prod:storage-check

echo
echo "Storage rollout complete."
echo "BINARY2048_ADMIN_TOKEN=${ADMIN_TOKEN}"
