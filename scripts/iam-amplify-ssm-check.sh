#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-dzxvs1esr22z9}"
AWS_REGION="${AWS_REGION:-us-east-2}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"
ROLE_ARN="$(aws amplify get-app --app-id "${APP_ID}" --region "${AWS_REGION}" --query 'app.iamServiceRoleArn' --output text)"

if [[ -z "${ROLE_ARN}" || "${ROLE_ARN}" == "None" ]]; then
  echo "IAM check failed: amplify app has no iamServiceRoleArn (app_id=${APP_ID})."
  exit 1
fi

SSM_RESOURCE="arn:aws:ssm:${AWS_REGION}:${ACCOUNT_ID}:parameter/amplify/${APP_ID}/*"
echo "Checking role access:"
echo "role_arn=${ROLE_ARN}"
echo "resource=${SSM_RESOURCE}"

RESULTS="$(
  aws iam simulate-principal-policy \
    --policy-source-arn "${ROLE_ARN}" \
    --action-names ssm:GetParameter ssm:GetParameters ssm:GetParametersByPath \
    --resource-arns "${SSM_RESOURCE}" \
    --query 'EvaluationResults[].EvalDecision' \
    --output text
)"

echo "decisions=${RESULTS}"
for required in ssm:GetParameter ssm:GetParameters ssm:GetParametersByPath; do
  :
done

if echo "${RESULTS}" | grep -q "implicitDeny\|explicitDeny"; then
  echo "IAM check failed: Amplify service role cannot read one or more required SSM parameters."
  exit 1
fi

echo "IAM check passed: Amplify service role can read required SSM auth parameters."
