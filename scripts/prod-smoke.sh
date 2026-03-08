#!/usr/bin/env bash
set -euo pipefail

BASE="${PROD_BASE:-https://www.binary2048.com}"
CURL_OPTS=(--connect-timeout 8 --max-time 20)

echo "Running production smoke checks against: ${BASE}"

HOME_HEADERS="$(curl -i -sS "${CURL_OPTS[@]}" "${BASE}/")"
if [[ "${HOME_HEADERS}" != *"HTTP/2 200"* && "${HOME_HEADERS}" != *"HTTP/1.1 200"* ]]; then
  echo "Prod smoke failed: / did not return 200"
  echo "${HOME_HEADERS}" | sed -n "1,40p"
  exit 1
fi

HOME_BODY="$(curl -sS "${CURL_OPTS[@]}" "${BASE}/")"
if [[ "${HOME_BODY}" != *"Binary 2048"* ]]; then
  echo "Prod smoke failed: expected app HTML marker not found on /"
  exit 1
fi

AUTH_HEADERS="$(curl -i -sS "${CURL_OPTS[@]}" "${BASE}/auth")"
if [[ "${AUTH_HEADERS}" != *"HTTP/2 200"* && "${AUTH_HEADERS}" != *"HTTP/1.1 200"* ]]; then
  echo "Prod smoke failed: /auth did not return 200"
  echo "${AUTH_HEADERS}" | sed -n "1,40p"
  exit 1
fi

HEALTH="$(curl -sS "${CURL_OPTS[@]}" "${BASE}/api/health")"
if [[ "${HEALTH}" != *"\"ok\":true"* ]]; then
  echo "Prod smoke failed: /api/health missing ok=true"
  echo "response: ${HEALTH}"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Prod smoke failed: jq is required for gameplay canary checks"
  exit 1
fi

CREATE_JSON="$(
  curl -sS "${CURL_OPTS[@]}" -X POST "${BASE}/api/games" \
    -H "content-type: application/json" \
    -d '{}'
)"
GAME_ID="$(echo "${CREATE_JSON}" | jq -r '.id // empty')"
if [[ -z "${GAME_ID}" ]]; then
  echo "Prod smoke failed: /api/games did not return id"
  echo "response: ${CREATE_JSON}"
  exit 1
fi

MOVE_JSON="$(
  curl -sS "${CURL_OPTS[@]}" -X POST "${BASE}/api/games/${GAME_ID}/move" \
    -H "content-type: application/json" \
    -d '{"dir":"left"}'
)"
if [[ "$(echo "${MOVE_JSON}" | jq -r '.id // empty')" != "${GAME_ID}" ]]; then
  echo "Prod smoke failed: move response id mismatch"
  echo "response: ${MOVE_JSON}"
  exit 1
fi

EXPORT_JSON="$(curl -sS "${CURL_OPTS[@]}" "${BASE}/api/games/${GAME_ID}/export?compact=1")"
if [[ "$(echo "${EXPORT_JSON}" | jq -r '.header.replayVersion // empty')" != "1" ]]; then
  echo "Prod smoke failed: export compact header.replayVersion missing/invalid"
  echo "response: ${EXPORT_JSON}"
  exit 1
fi
if [[ "$(echo "${EXPORT_JSON}" | jq -r '.moves | length')" == "0" ]]; then
  echo "Prod smoke failed: export compact contains zero moves after canary move"
  echo "response: ${EXPORT_JSON}"
  exit 1
fi

echo "Production smoke checks passed."
