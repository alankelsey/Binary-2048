#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
TOPIC_NAME="${TOPIC_NAME:-binary2048-billing-alerts}"
SUBSCRIBE_EMAIL="${SUBSCRIBE_EMAIL:-}"

echo "==> Creating or reusing SNS topic '${TOPIC_NAME}'"
TOPIC_ARN="$(
  aws sns create-topic \
    --region "${AWS_REGION}" \
    --name "${TOPIC_NAME}" \
    --query "TopicArn" \
    --output text
)"

echo "TOPIC_ARN=${TOPIC_ARN}"

if [[ -n "${SUBSCRIBE_EMAIL}" ]]; then
  echo "==> Subscribing email ${SUBSCRIBE_EMAIL}"
  aws sns subscribe \
    --region "${AWS_REGION}" \
    --topic-arn "${TOPIC_ARN}" \
    --protocol email \
    --notification-endpoint "${SUBSCRIBE_EMAIL}" \
    --query "SubscriptionArn" \
    --output text >/dev/null
  echo "Subscription requested. Confirm via email to activate."
else
  echo "No SUBSCRIBE_EMAIL provided; skipping subscription."
fi
