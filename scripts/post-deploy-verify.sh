#!/usr/bin/env bash
set -euo pipefail

ATTEMPTS="${PROD_VERIFY_ATTEMPTS:-20}"
SLEEP_SECONDS="${PROD_VERIFY_SLEEP_SECONDS:-20}"

echo "Running post-deploy production verification."
echo "attempts=${ATTEMPTS} sleep_seconds=${SLEEP_SECONDS}"

for attempt in $(seq 1 "${ATTEMPTS}"); do
  echo "verification attempt ${attempt}/${ATTEMPTS}"
  if bash ./scripts/prod-smoke.sh; then
    echo "Post-deploy verification passed."
    exit 0
  fi

  if [[ "${attempt}" -lt "${ATTEMPTS}" ]]; then
    echo "Verification not ready yet. Sleeping ${SLEEP_SECONDS}s..."
    sleep "${SLEEP_SECONDS}"
  fi
done

echo "Post-deploy verification failed after ${ATTEMPTS} attempts."
exit 1
