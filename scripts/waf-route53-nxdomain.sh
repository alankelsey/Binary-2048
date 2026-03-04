#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
QUERY_LOG_GROUP_NAME="${QUERY_LOG_GROUP_NAME:-}"
METRIC_NAMESPACE="${METRIC_NAMESPACE:-Binary2048/Route53}"
METRIC_NAME="${METRIC_NAME:-NXDomainCount}"
METRIC_FILTER_NAME="${METRIC_FILTER_NAME:-route53-nxdomain-filter}"
ALARM_NAME="${ALARM_NAME:-Route53NXDomainSpike}"
THRESHOLD="${THRESHOLD:-200}"
PERIOD_SECONDS="${PERIOD_SECONDS:-300}"
EVALUATION_PERIODS="${EVALUATION_PERIODS:-1}"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:-}"

if [[ -z "${QUERY_LOG_GROUP_NAME}" ]]; then
  echo "error: QUERY_LOG_GROUP_NAME is required (Route 53 query log group name)" >&2
  echo "usage: QUERY_LOG_GROUP_NAME=/aws/route53/your-zone npm run ops:waf:nxdomain" >&2
  exit 1
fi

echo "==> Creating/updating metric filter ${METRIC_FILTER_NAME}"
aws logs put-metric-filter \
  --region "${AWS_REGION}" \
  --log-group-name "${QUERY_LOG_GROUP_NAME}" \
  --filter-name "${METRIC_FILTER_NAME}" \
  --filter-pattern '{ $.rcode = "NXDOMAIN" }' \
  --metric-transformations \
    metricName="${METRIC_NAME}",metricNamespace="${METRIC_NAMESPACE}",metricValue=1,defaultValue=0

echo "==> Creating/updating alarm ${ALARM_NAME}"
if [[ -n "${SNS_TOPIC_ARN}" ]]; then
  aws cloudwatch put-metric-alarm \
    --region "${AWS_REGION}" \
    --alarm-name "${ALARM_NAME}" \
    --metric-name "${METRIC_NAME}" \
    --namespace "${METRIC_NAMESPACE}" \
    --statistic Sum \
    --period "${PERIOD_SECONDS}" \
    --evaluation-periods "${EVALUATION_PERIODS}" \
    --threshold "${THRESHOLD}" \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions "${SNS_TOPIC_ARN}"
else
  aws cloudwatch put-metric-alarm \
    --region "${AWS_REGION}" \
    --alarm-name "${ALARM_NAME}" \
    --metric-name "${METRIC_NAME}" \
    --namespace "${METRIC_NAMESPACE}" \
    --statistic Sum \
    --period "${PERIOD_SECONDS}" \
    --evaluation-periods "${EVALUATION_PERIODS}" \
    --threshold "${THRESHOLD}" \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching
fi

echo "==> Done"
echo "log_group=${QUERY_LOG_GROUP_NAME}"
echo "metric=${METRIC_NAMESPACE}/${METRIC_NAME}"
echo "alarm=${ALARM_NAME}"

