#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
APP_DOMAIN="${APP_DOMAIN:-}"

echo "==> CloudFront distributions (region hint: ${AWS_REGION})"

if [[ -n "${APP_DOMAIN}" ]]; then
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(DomainName, '${APP_DOMAIN}') || contains(Comment, '${APP_DOMAIN}')].[Id,DomainName,Comment]" \
    --output table
else
  aws cloudfront list-distributions \
    --query "DistributionList.Items[].[Id,DomainName,Comment]" \
    --output table
fi

echo
echo "Tip: set APP_DOMAIN=binary2048.com (or your amplifyapp domain) to narrow results."
