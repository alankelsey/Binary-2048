#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
DIST_ID="${DIST_ID:-}"
OUT_DIR="${OUT_DIR:-./docs/waf-exports}"

if [[ -z "${DIST_ID}" ]]; then
  echo "error: DIST_ID is required (CloudFront distribution id, e.g. E123ABC456XYZ)" >&2
  echo "usage: DIST_ID=E123ABC456XYZ npm run ops:waf:export" >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"
mkdir -p "${OUT_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"

WEB_ACL_NAME="$(
  aws wafv2 get-web-acl-for-resource \
    --region "${AWS_REGION}" \
    --resource-arn "${DIST_ARN}" \
    --query "WebACL.Name" \
    --output text
)"
WEB_ACL_ID="$(
  aws wafv2 get-web-acl-for-resource \
    --region "${AWS_REGION}" \
    --resource-arn "${DIST_ARN}" \
    --query "WebACL.Id" \
    --output text
)"
WEB_ACL_ARN="$(
  aws wafv2 get-web-acl-for-resource \
    --region "${AWS_REGION}" \
    --resource-arn "${DIST_ARN}" \
    --query "WebACL.ARN" \
    --output text
)"

if [[ -z "${WEB_ACL_ARN}" || "${WEB_ACL_ARN}" == "None" ]]; then
  echo "error: no Web ACL currently associated with ${DIST_ARN}" >&2
  exit 1
fi

ACL_OUT="${OUT_DIR}/web-acl-${DIST_ID}-${STAMP}.json"
LOG_OUT="${OUT_DIR}/logging-${DIST_ID}-${STAMP}.json"

echo "==> Exporting Web ACL to ${ACL_OUT}"
aws wafv2 get-web-acl \
  --region "${AWS_REGION}" \
  --scope CLOUDFRONT \
  --name "${WEB_ACL_NAME}" \
  --id "${WEB_ACL_ID}" >"${ACL_OUT}"

echo "==> Exporting logging config to ${LOG_OUT}"
aws wafv2 get-logging-configuration \
  --region "${AWS_REGION}" \
  --resource-arn "${WEB_ACL_ARN}" >"${LOG_OUT}" 2>/dev/null || echo "{\"LoggingConfiguration\":null}" >"${LOG_OUT}"

echo "Done."
echo "Web ACL backup: ${ACL_OUT}"
echo "Logging backup: ${LOG_OUT}"
