#!/usr/bin/env bash
set -euo pipefail

BASE="${PROD_BASE:-https://www.binary2048.com}"
ADMIN_TOKEN="${BINARY2048_ADMIN_TOKEN:-}"
CURL_OPTS=(--connect-timeout 8 --max-time 30)

if [[ -z "${ADMIN_TOKEN}" ]]; then
  echo "prod storage check failed: BINARY2048_ADMIN_TOKEN is required"
  exit 1
fi

echo "Running production storage check against: ${BASE}"

RESP="$(
  curl -sS "${CURL_OPTS[@]}" \
    -H "x-admin-token: ${ADMIN_TOKEN}" \
    "${BASE}/api/ops/storage/health"
)"

if ! command -v jq >/dev/null 2>&1; then
  echo "prod storage check failed: jq is required"
  exit 1
fi

OK="$(echo "${RESP}" | jq -r '.ok // false')"
if [[ "${OK}" != "true" ]]; then
  echo "prod storage check failed: endpoint returned not-ok"
  echo "${RESP}"
  exit 1
fi

HAS_REPLAY="$(echo "${RESP}" | jq -r '.persisted.hasReplayPayload // false')"
if [[ "${HAS_REPLAY}" != "true" ]]; then
  echo "prod storage check failed: replay payload was not retrievable"
  echo "${RESP}"
  exit 1
fi

echo "Production storage check passed."
echo "${RESP}" | jq .

