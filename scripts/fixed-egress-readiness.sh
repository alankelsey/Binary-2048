#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ID="${APP_ID:-}"
BRANCH_NAME="${BRANCH_NAME:-main}"
AWS_REGION="${AWS_REGION:-us-east-2}"

say() {
  printf '%s\n' "$*"
}

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    say "missing required command: $name"
    exit 1
  fi
}

require_cmd aws
require_cmd node

if [ -z "$APP_ID" ]; then
  say "APP_ID is required."
  say "Example:"
  say "  APP_ID=dzxvs1esr22z9 BRANCH_NAME=main AWS_REGION=us-east-2 npm run ops:egress:readiness"
  exit 1
fi

say "fixed egress readiness"
say "  app=$APP_ID"
say "  branch=$BRANCH_NAME"
say "  region=$AWS_REGION"

ENV_JSON="$(aws amplify get-branch \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH_NAME" \
  --region "$AWS_REGION" \
  --query 'branch.environmentVariables' \
  --output json)"

node <<'EOF' "$ENV_JSON"
const env = JSON.parse(process.argv[2]);
const required = [
  "BINARY2048_MONGO_URI",
  "BINARY2048_MONGO_DB",
  "BINARY2048_MONGO_RUN_COLLECTION",
  "BINARY2048_MONGO_SESSION_COLLECTION",
  "BINARY2048_REPLAY_S3_BUCKET",
  "BINARY2048_REPLAY_S3_REGION",
  "BINARY2048_ADMIN_TOKEN"
];

const missing = required.filter((key) => !env[key]);
console.log("env checks:");
for (const key of required) {
  console.log(`  ${key}: ${env[key] ? "present" : "missing"}`);
}

if (missing.length > 0) {
  console.error("\nmissing required env vars:");
  for (const key of missing) console.error(`  - ${key}`);
  process.exit(1);
}
EOF

say
say "next manual checks"
say "  1. provision VPC, private subnets, public subnet, NAT Gateway, and Elastic IP"
say "  2. deploy a small Lambda or Fargate workload for Mongo-backed routes"
say "  3. allowlist the NAT Elastic IP in Atlas Network Access"
say "  4. run production storage/auth verification against the new runtime before cutover"
say "  5. remove the broad Atlas allowlist only after the new runtime is proven stable"
