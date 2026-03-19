#!/usr/bin/env bash
set -euo pipefail

TEMPLATE_PATH="${TEMPLATE_PATH:-infra/fixed-egress-vpc-template.yml}"
AWS_REGION="${AWS_REGION:-us-east-2}"
STACK_NAME="${STACK_NAME:-binary2048-fixed-egress}"

require_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "missing required command: $name"
    exit 1
  fi
}

require_cmd aws

if [ ! -f "$TEMPLATE_PATH" ]; then
  echo "template not found: $TEMPLATE_PATH"
  exit 1
fi

echo "fixed egress preflight"
echo "  template=$TEMPLATE_PATH"
echo "  region=$AWS_REGION"
echo "  stack=$STACK_NAME"

echo
echo "aws caller identity"
aws sts get-caller-identity --output json

echo
echo "validating CloudFormation template"
aws cloudformation validate-template \
  --template-body "file://$TEMPLATE_PATH" \
  --region "$AWS_REGION" \
  --output json >/dev/null
echo "template validation passed"

echo
echo "next deploy command"
echo "aws cloudformation deploy \\"
echo "  --template-file $TEMPLATE_PATH \\"
echo "  --stack-name $STACK_NAME \\"
echo "  --region $AWS_REGION \\"
echo "  --parameter-overrides ProjectName=binary2048"
