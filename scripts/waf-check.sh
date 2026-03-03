#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
DIST_ID="${DIST_ID:-}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
REQUIRED_API_RATE_LIMIT="${REQUIRED_API_RATE_LIMIT:-600}"
REQUIRED_GLOBAL_RATE_LIMIT="${REQUIRED_GLOBAL_RATE_LIMIT:-2000}"

if [[ -z "${DIST_ID}" ]]; then
  echo "error: DIST_ID is required (CloudFront distribution id, e.g. E123ABC456XYZ)" >&2
  echo "usage: DIST_ID=E123ABC456XYZ npm run ops:waf:check" >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"

PASS=0
FAIL=0

ok() {
  PASS=$((PASS + 1))
  echo "PASS: $1"
}

bad() {
  FAIL=$((FAIL + 1))
  echo "FAIL: $1"
}

echo "==> Checking WAF for ${DIST_ARN}"
WEB_ACL_ARN="$(
  aws wafv2 get-web-acl-for-resource \
    --region "${AWS_REGION}" \
    --resource-arn "${DIST_ARN}" \
    --query "WebACL.ARN" \
    --output text 2>/dev/null || true
)"

if [[ -n "${WEB_ACL_ARN}" && "${WEB_ACL_ARN}" != "None" ]]; then
  ok "Web ACL associated"
else
  bad "No Web ACL associated to CloudFront distribution"
  echo "Summary: ${PASS} passed, ${FAIL} failed"
  exit 1
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

RULE_NAMES="$(
  aws wafv2 get-web-acl \
    --region "${AWS_REGION}" \
    --scope CLOUDFRONT \
    --name "${WEB_ACL_NAME}" \
    --id "${WEB_ACL_ID}" \
    --query "WebACL.Rules[].Name" \
    --output text
)"

require_rule() {
  local rule="$1"
  if [[ "${RULE_NAMES}" == *"${rule}"* ]]; then
    ok "Rule present: ${rule}"
  else
    bad "Missing rule: ${rule}"
  fi
}

require_rule "AWSManagedRulesAmazonIpReputationList"
require_rule "AWSManagedRulesKnownBadInputsRuleSet"
require_rule "AWSManagedRulesCommonRuleSet"
require_rule "RateLimitApi"
require_rule "RateLimitGlobal"

RATE_API_LIMIT="$(
  aws wafv2 get-web-acl \
    --region "${AWS_REGION}" \
    --scope CLOUDFRONT \
    --name "${WEB_ACL_NAME}" \
    --id "${WEB_ACL_ID}" \
    --query "WebACL.Rules[?Name=='RateLimitApi'].Statement.RateBasedStatement.Limit | [0]" \
    --output text
)"
RATE_GLOBAL_LIMIT="$(
  aws wafv2 get-web-acl \
    --region "${AWS_REGION}" \
    --scope CLOUDFRONT \
    --name "${WEB_ACL_NAME}" \
    --id "${WEB_ACL_ID}" \
    --query "WebACL.Rules[?Name=='RateLimitGlobal'].Statement.RateBasedStatement.Limit | [0]" \
    --output text
)"

if [[ "${RATE_API_LIMIT}" == "${REQUIRED_API_RATE_LIMIT}" ]]; then
  ok "RateLimitApi threshold is ${RATE_API_LIMIT}"
else
  bad "RateLimitApi threshold mismatch (expected ${REQUIRED_API_RATE_LIMIT}, got ${RATE_API_LIMIT})"
fi

if [[ "${RATE_GLOBAL_LIMIT}" == "${REQUIRED_GLOBAL_RATE_LIMIT}" ]]; then
  ok "RateLimitGlobal threshold is ${RATE_GLOBAL_LIMIT}"
else
  bad "RateLimitGlobal threshold mismatch (expected ${REQUIRED_GLOBAL_RATE_LIMIT}, got ${RATE_GLOBAL_LIMIT})"
fi

LOG_DEST="$(
  aws wafv2 get-logging-configuration \
    --region "${AWS_REGION}" \
    --resource-arn "${WEB_ACL_ARN}" \
    --query "LoggingConfiguration.LogDestinationConfigs[0]" \
    --output text 2>/dev/null || true
)"
if [[ -n "${LOG_DEST}" && "${LOG_DEST}" != "None" ]]; then
  ok "WAF logging configured"
else
  bad "WAF logging is not configured"
fi

if [[ -n "${HOSTED_ZONE_ID}" ]]; then
  STAR_RECORDS="$(
    aws route53 list-resource-record-sets \
      --hosted-zone-id "${HOSTED_ZONE_ID}" \
      --query "ResourceRecordSets[?starts_with(Name, '*.')].Name" \
      --output text
  )"
  if [[ -z "${STAR_RECORDS}" || "${STAR_RECORDS}" == "None" ]]; then
    ok "No wildcard DNS records found"
  else
    bad "Wildcard DNS records found: ${STAR_RECORDS}"
  fi
fi

echo "Summary: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi
