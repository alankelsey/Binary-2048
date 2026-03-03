#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
DIST_ID="${DIST_ID:-}"

if [[ -z "${DIST_ID}" ]]; then
  echo "error: DIST_ID is required (CloudFront distribution id, e.g. E123ABC456XYZ)" >&2
  echo "usage: DIST_ID=E123ABC456XYZ npm run ops:waf:status" >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"

echo "==> Distribution"
echo "DIST_ID=${DIST_ID}"
echo "DIST_ARN=${DIST_ARN}"
echo

echo "==> Fetching associated Web ACL"
WEB_ACL_ARN="$(
  aws wafv2 get-web-acl-for-resource \
    --region "${AWS_REGION}" \
    --resource-arn "${DIST_ARN}" \
    --query "WebACL.ARN" \
    --output text 2>/dev/null || true
)"

if [[ -z "${WEB_ACL_ARN}" || "${WEB_ACL_ARN}" == "None" ]]; then
  echo "No Web ACL is currently associated."
  exit 0
fi

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

echo "WEB_ACL_NAME=${WEB_ACL_NAME}"
echo "WEB_ACL_ID=${WEB_ACL_ID}"
echo "WEB_ACL_ARN=${WEB_ACL_ARN}"
echo

echo "==> Rule summary"
aws wafv2 get-web-acl \
  --region "${AWS_REGION}" \
  --scope CLOUDFRONT \
  --name "${WEB_ACL_NAME}" \
  --id "${WEB_ACL_ID}" \
  --query "WebACL.Rules[].[Priority,Name, to_string(Statement.RateBasedStatement.Limit)]" \
  --output table
echo

echo "==> Rate-based rules"
aws wafv2 get-web-acl \
  --region "${AWS_REGION}" \
  --scope CLOUDFRONT \
  --name "${WEB_ACL_NAME}" \
  --id "${WEB_ACL_ID}" \
  --query "WebACL.Rules[?Statement.RateBasedStatement].{Priority:Priority,Name:Name,Limit:Statement.RateBasedStatement.Limit}" \
  --output table
echo

echo "==> Logging configuration"
if aws wafv2 get-logging-configuration \
  --region "${AWS_REGION}" \
  --resource-arn "${WEB_ACL_ARN}" \
  --query "LoggingConfiguration.LogDestinationConfigs" \
  --output table >/tmp/waf-logging-status.$$ 2>/dev/null; then
  cat /tmp/waf-logging-status.$$
  rm -f /tmp/waf-logging-status.$$
else
  echo "No logging destination configured."
fi
