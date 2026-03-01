#!/usr/bin/env bash
set -euo pipefail

PORT=4110
LOG_FILE="/tmp/binary2048-smoke.log"
BASE="http://localhost:${PORT}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

npm run start -- -p "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 40); do
  if curl -fsS "${BASE}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

HOME_HTML="$(curl -fsS "${BASE}/")"
if [[ "${HOME_HTML}" != *"Binary 2048"* ]]; then
  echo "Smoke test failed: / did not return expected app markup"
  exit 1
fi

HEALTH="$(curl -fsS "${BASE}/api/health")"
if [[ "${HEALTH}" != *'"ok":true'* ]]; then
  echo "Smoke test failed: /api/health did not return ok=true"
  echo "response: ${HEALTH}"
  exit 1
fi

GAME_RESP="$(curl -fsS -X POST "${BASE}/api/games" -H "Content-Type: application/json" -d '{}')"
if [[ "${GAME_RESP}" != *'"id":"'* ]]; then
  echo "Smoke test failed: /api/games did not return a game id"
  echo "response: ${GAME_RESP}"
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  GAME_ID="$(echo "${GAME_RESP}" | jq -r '.id')"
else
  GAME_ID="$(echo "${GAME_RESP}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
fi

if [[ -z "${GAME_ID}" || "${GAME_ID}" == "null" ]]; then
  echo "Smoke test failed: unable to parse game id from /api/games response"
  echo "response: ${GAME_RESP}"
  exit 1
fi

GAME_GET_RESP="$(curl -fsS "${BASE}/api/games/${GAME_ID}")"
if [[ "${GAME_GET_RESP}" != *"\"id\":\"${GAME_ID}\""* ]]; then
  echo "Smoke test failed: /api/games/${GAME_ID} did not return expected game id"
  echo "response: ${GAME_GET_RESP}"
  exit 1
fi

MOVE_RESP="$(curl -fsS -X POST "${BASE}/api/games/${GAME_ID}/move" -H "Content-Type: application/json" -d '{"dir":"left"}')"
if [[ "${MOVE_RESP}" != *'"current"'* ]]; then
  echo "Smoke test failed: /api/games/${GAME_ID}/move did not return current state"
  echo "response: ${MOVE_RESP}"
  exit 1
fi

EXPORT_RESP="$(curl -fsS "${BASE}/api/games/${GAME_ID}/export")"
if [[ "${EXPORT_RESP}" != *'"version": 1'* && "${EXPORT_RESP}" != *'"version":1'* ]]; then
  echo "Smoke test failed: /api/games/${GAME_ID}/export missing version field"
  echo "response: ${EXPORT_RESP}"
  exit 1
fi

SIM_RESP="$(curl -fsS -X POST "${BASE}/api/sim/run" -H "Content-Type: application/json" -d '{"config":{"width":4,"height":4,"seed":99,"winTile":2048,"zeroBehavior":"annihilate","spawnOnNoopMove":false,"spawn":{"pZero":0,"pOne":1,"pWildcard":0,"wildcardMultipliers":[2,4,8]}},"initialGrid":[[{"t":"w","m":2},{"t":"w","m":2},{"t":"n","v":1},null],[null,null,null,null],[null,null,null,null],[null,null,null,null]],"moves":["left"]}')"
if [[ "${SIM_RESP}" != *'"version":1'* && "${SIM_RESP}" != *'"version": 1'* ]]; then
  echo "Smoke test failed: /api/sim/run missing version field"
  echo "response: ${SIM_RESP}"
  exit 1
fi

echo "Build smoke test passed."
