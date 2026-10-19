#!/usr/bin/env bash
set -euo pipefail

APP_ID="${APP_ID:-}"
BRANCH_NAME="${BRANCH_NAME:-main}"
AWS_REGION="${AWS_REGION:-us-east-2}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-900}"
POLL_SECONDS="${POLL_SECONDS:-45}"
REPORT_SECONDS="${REPORT_SECONDS:-60}"
EXPECT_COMMIT_ID="${EXPECT_COMMIT_ID:-}"

if [[ -z "${APP_ID}" ]]; then
  echo "APP_ID is required (Amplify app id)." >&2
  exit 1
fi

latest_job_id() {
  aws amplify list-jobs \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH_NAME}" \
    --region "${AWS_REGION}" \
    --max-items 1 \
    --query "jobSummaries[0].jobId" \
    --output text | awk "NF { print \$1; exit }"
}

job_summary() {
  local job_id="$1"
  aws amplify get-job \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH_NAME}" \
    --job-id "${job_id}" \
    --region "${AWS_REGION}" \
    --query "[job.summary.status, job.summary.commitId]" \
    --output text
}

job_url() {
  local job_id="$1"
  aws amplify get-job \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH_NAME}" \
    --job-id "${job_id}" \
    --region "${AWS_REGION}" \
    --query "job.summary.jobArn" \
    --output text
}

JOB_ID="$(latest_job_id)"
if [[ -z "${JOB_ID}" || "${JOB_ID}" == "None" ]]; then
  echo "No Amplify jobs found for app=${APP_ID} branch=${BRANCH_NAME} region=${AWS_REGION}" >&2
  exit 1
fi

echo "Watching Amplify job ${JOB_ID} for ${APP_ID}/${BRANCH_NAME} in ${AWS_REGION}"
START_EPOCH="$(date +%s)"
LAST_REPORT_EPOCH=0
LAST_STATUS=""

while true; do
  read -r STATUS COMMIT_ID <<< "$(job_summary "${JOB_ID}")"
  NOW_EPOCH="$(date +%s)"
  ELAPSED="$((NOW_EPOCH - START_EPOCH))"

  if [[ -n "${EXPECT_COMMIT_ID}" && "${COMMIT_ID}" != "${EXPECT_COMMIT_ID}" ]]; then
    echo "Amplify commit mismatch: expected=${EXPECT_COMMIT_ID} actual=${COMMIT_ID} job=${JOB_ID}" >&2
    exit 4
  fi

  if [[ "${STATUS}" != "${LAST_STATUS}" || $((NOW_EPOCH - LAST_REPORT_EPOCH)) -ge "${REPORT_SECONDS}" ]]; then
    echo "status=${STATUS} elapsed=${ELAPSED}s commit=${COMMIT_ID}"
    LAST_STATUS="${STATUS}"
    LAST_REPORT_EPOCH="${NOW_EPOCH}"
  fi

  case "${STATUS}" in
    SUCCEED)
      echo "Amplify deploy succeeded for job ${JOB_ID}"
      if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        {
          echo "job_id=${JOB_ID}"
          echo "commit_id=${COMMIT_ID}"
        } >> "${GITHUB_OUTPUT}"
      fi
      exit 0
      ;;
    FAILED|CANCELLED)
      echo "Amplify deploy failed: job=${JOB_ID} status=${STATUS}" >&2
      echo "Job ARN: $(job_url "${JOB_ID}")" >&2
      exit 2
      ;;
  esac

  if (( ELAPSED >= TIMEOUT_SECONDS )); then
    echo "Timed out waiting for Amplify deploy completion (${TIMEOUT_SECONDS}s)." >&2
    exit 3
  fi

  sleep "${POLL_SECONDS}"
done
