#!/usr/bin/env bash
set -euo pipefail

BASE="${PROD_BASE:-https://www.binary2048.com}"
APP_ID="${APP_ID:-dzxvs1esr22z9}"
AWS_REGION="${AWS_REGION:-us-east-2}"
BRANCH_NAME="${BRANCH_NAME:-main}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${INCIDENT_BUNDLE_DIR:-artifacts/incident-${STAMP}}"
CURL_OPTS=(--connect-timeout 8 --max-time 20)

mkdir -p "${OUT_DIR}"

capture_endpoint() {
  local path="$1"
  local safe_name
  safe_name="$(echo "${path}" | sed 's#[^a-zA-Z0-9]#_#g')"
  if [[ -z "${safe_name}" || "${safe_name}" == "_" ]]; then
    safe_name="root"
  fi
  local headers_file="${OUT_DIR}/${safe_name}.headers.txt"
  local body_file="${OUT_DIR}/${safe_name}.body.txt"
  local meta_file="${OUT_DIR}/${safe_name}.meta.txt"
  local url="${BASE}${path}"

  echo "Capturing ${url}"
  curl -sS "${CURL_OPTS[@]}" -D "${headers_file}" -o "${body_file}" "${url}" || true
  {
    echo "url=${url}"
    echo "captured_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    awk 'toupper($1) ~ /^HTTP\// { print "status=" $2; exit }' "${headers_file}"
  } > "${meta_file}"
}

capture_endpoint "/"
capture_endpoint "/auth"
capture_endpoint "/api/health"
capture_endpoint "/api/auth/providers"
capture_endpoint "/api/auth/signin"

if command -v npm >/dev/null 2>&1; then
  PROD_BASE="${BASE}" npm run -s ops:prod:fingerprints > "${OUT_DIR}/fingerprints.log" 2>&1 || true
fi

if command -v aws >/dev/null 2>&1; then
  aws sts get-caller-identity > "${OUT_DIR}/aws-sts-identity.json" 2>&1 || true
  aws amplify list-jobs \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH_NAME}" \
    --region "${AWS_REGION}" \
    --max-items 1 \
    > "${OUT_DIR}/amplify-latest-job.json" 2>&1 || true

  aws amplify get-branch \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH_NAME}" \
    --region "${AWS_REGION}" \
    --query "keys(branch.environmentVariables)" \
    --output json \
    > "${OUT_DIR}/amplify-branch-env-keys.json" 2>&1 || true
fi

cat > "${OUT_DIR}/SUMMARY.md" <<EOF
# Incident Evidence Bundle

- generated_at_utc: ${STAMP}
- base: ${BASE}
- app_id: ${APP_ID}
- region: ${AWS_REGION}
- branch: ${BRANCH_NAME}

## Included Artifacts

- Endpoint captures (headers/body/meta):
  - \`_root\`
  - \`_auth\`
  - \`_api_health\`
  - \`_api_auth_providers\`
  - \`_api_auth_signin\`
- \`fingerprints.log\` (from \`ops:prod:fingerprints\`)
- \`aws-sts-identity.json\` (if aws cli configured)
- \`amplify-latest-job.json\` (if aws cli configured)
- \`amplify-branch-env-keys.json\` (if aws cli configured)

## Useful Console Links

- Amplify app: https://us-east-2.console.aws.amazon.com/amplify/apps/${APP_ID}
- Amplify branch main: https://us-east-2.console.aws.amazon.com/amplify/apps/${APP_ID}/branches/main
- CloudWatch logs (global): https://console.aws.amazon.com/cloudwatch/home
EOF

echo "Incident evidence bundle written to: ${OUT_DIR}"
