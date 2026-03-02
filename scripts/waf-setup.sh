#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

AWS_REGION="${AWS_REGION:-us-east-1}"
WEB_ACL_NAME="${WEB_ACL_NAME:-binary2048-web-acl}"
DIST_ID="${DIST_ID:-}"
LOG_GROUP_NAME="${LOG_GROUP_NAME:-}"

if [[ -z "${DIST_ID}" ]]; then
  echo "error: DIST_ID is required (CloudFront distribution id, e.g. E123ABC456XYZ)" >&2
  echo "usage: DIST_ID=E123ABC456XYZ npm run ops:waf:setup" >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"

echo "==> Looking for existing Web ACL '${WEB_ACL_NAME}' in ${AWS_REGION}"
WEB_ACL_ARN="$(
  aws wafv2 list-web-acls \
    --scope CLOUDFRONT \
    --region "${AWS_REGION}" \
    --query "WebACLs[?Name=='${WEB_ACL_NAME}'].ARN | [0]" \
    --output text
)"

if [[ "${WEB_ACL_ARN}" == "None" || -z "${WEB_ACL_ARN}" ]]; then
  echo "==> Creating Web ACL from template"
  TEMPLATE="${ROOT_DIR}/docs/waf-web-acl-template.json"
  TMP_TEMPLATE="$(mktemp)"
  cp "${TEMPLATE}" "${TMP_TEMPLATE}"
  sed -i.bak "s/\"Name\": \"binary2048-web-acl\"/\"Name\": \"${WEB_ACL_NAME}\"/" "${TMP_TEMPLATE}"
  rm -f "${TMP_TEMPLATE}.bak"

  WEB_ACL_ARN="$(
    aws wafv2 create-web-acl \
      --region "${AWS_REGION}" \
      --scope CLOUDFRONT \
      --cli-input-json "file://${TMP_TEMPLATE}" \
      --query "Summary.ARN" \
      --output text
  )"
  rm -f "${TMP_TEMPLATE}"
else
  echo "==> Reusing existing Web ACL: ${WEB_ACL_ARN}"
fi

echo "==> Associating Web ACL with distribution ${DIST_ID}"
aws wafv2 associate-web-acl \
  --region "${AWS_REGION}" \
  --web-acl-arn "${WEB_ACL_ARN}" \
  --resource-arn "${DIST_ARN}"

if [[ -n "${LOG_GROUP_NAME}" ]]; then
  echo "==> Ensuring log group exists: ${LOG_GROUP_NAME}"
  aws logs create-log-group \
    --region "${AWS_REGION}" \
    --log-group-name "${LOG_GROUP_NAME}" 2>/dev/null || true

  LOG_GROUP_ARN="arn:aws:logs:${AWS_REGION}:${ACCOUNT_ID}:log-group:${LOG_GROUP_NAME}"
  echo "==> Enabling WAF logging to ${LOG_GROUP_ARN}"
  aws wafv2 put-logging-configuration \
    --region "${AWS_REGION}" \
    --logging-configuration "{\"ResourceArn\":\"${WEB_ACL_ARN}\",\"LogDestinationConfigs\":[\"${LOG_GROUP_ARN}\"]}"
fi

echo "==> Done"
echo "WEB_ACL_ARN=${WEB_ACL_ARN}"
echo "DIST_ARN=${DIST_ARN}"
