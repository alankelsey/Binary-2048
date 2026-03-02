#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
DIST_ID="${DIST_ID:-}"

if [[ -z "${DIST_ID}" ]]; then
  echo "error: DIST_ID is required (CloudFront distribution id, e.g. E123ABC456XYZ)" >&2
  echo "usage: DIST_ID=E123ABC456XYZ npm run ops:waf:rollback" >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"

echo "==> Disassociating WAF Web ACL from ${DIST_ARN}"
aws wafv2 disassociate-web-acl \
  --region "${AWS_REGION}" \
  --resource-arn "${DIST_ARN}"

echo "==> Verifying disassociation"
aws wafv2 get-web-acl-for-resource \
  --region "${AWS_REGION}" \
  --resource-arn "${DIST_ARN}" \
  --output json || true
