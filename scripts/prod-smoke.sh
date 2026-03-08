#!/usr/bin/env bash
set -euo pipefail

BASE="${PROD_BASE:-https://www.binary2048.com}"

echo "Running production smoke checks against: ${BASE}"

HOME_HEADERS="$(curl -i -sS "${BASE}/")"
if [[ "${HOME_HEADERS}" != *"HTTP/2 200"* && "${HOME_HEADERS}" != *"HTTP/1.1 200"* ]]; then
  echo "Prod smoke failed: / did not return 200"
  echo "${HOME_HEADERS}" | sed -n "1,40p"
  exit 1
fi

HOME_BODY="$(curl -sS "${BASE}/")"
if [[ "${HOME_BODY}" != *"Binary 2048"* ]]; then
  echo "Prod smoke failed: expected app HTML marker not found on /"
  exit 1
fi

AUTH_HEADERS="$(curl -i -sS "${BASE}/auth")"
if [[ "${AUTH_HEADERS}" != *"HTTP/2 200"* && "${AUTH_HEADERS}" != *"HTTP/1.1 200"* ]]; then
  echo "Prod smoke failed: /auth did not return 200"
  echo "${AUTH_HEADERS}" | sed -n "1,40p"
  exit 1
fi

HEALTH="$(curl -sS "${BASE}/api/health")"
if [[ "${HEALTH}" != *"\"ok\":true"* ]]; then
  echo "Prod smoke failed: /api/health missing ok=true"
  echo "response: ${HEALTH}"
  exit 1
fi

echo "Production smoke checks passed."
