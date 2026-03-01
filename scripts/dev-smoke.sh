#!/usr/bin/env bash
set -euo pipefail

PORT=4111
LOG_FILE="/tmp/binary2048-dev-smoke.log"
BASE="http://localhost:${PORT}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

npm run dev -- -p "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 80); do
  if curl -fsS "${BASE}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

curl -fsS "${BASE}/" >/dev/null
GAME_RESP="$(curl -fsS -X POST "${BASE}/api/games" -H "Content-Type: application/json" -d '{}')"

if command -v jq >/dev/null 2>&1; then
  GAME_ID="$(echo "${GAME_RESP}" | jq -r '.id')"
else
  GAME_ID="$(echo "${GAME_RESP}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
fi

if [[ -z "${GAME_ID}" || "${GAME_ID}" == "null" ]]; then
  echo "Dev smoke test failed: unable to parse game id"
  echo "response: ${GAME_RESP}"
  exit 1
fi

curl -fsS -X POST "${BASE}/api/games/${GAME_ID}/move" -H "Content-Type: application/json" -d '{"dir":"left"}' >/dev/null
curl -fsS "${BASE}/api/games/${GAME_ID}/export" >/dev/null
curl -fsS -X POST "${BASE}/api/sim/run" -H "Content-Type: application/json" -d '{"config":{"width":4,"height":4,"seed":99,"winTile":2048,"zeroBehavior":"annihilate","spawnOnNoopMove":false,"spawn":{"pZero":0,"pOne":1,"pWildcard":0,"wildcardMultipliers":[2,4,8]}},"initialGrid":[[{"t":"w","m":2},{"t":"w","m":2},{"t":"n","v":1},null],[null,null,null,null],[null,null,null,null],[null,null,null,null]],"moves":["left"]}' >/dev/null

if grep -q "segment-explorer-node.js#SegmentViewNode" "${LOG_FILE}" || grep -q "React Client Manifest" "${LOG_FILE}"; then
  echo "Dev smoke test failed: detected React Client Manifest/segment-explorer error."
  echo "Log excerpt:"
  grep -n "segment-explorer-node.js#SegmentViewNode\|React Client Manifest" "${LOG_FILE}" | sed -n '1,40p'
  exit 1
fi

echo "Dev smoke test passed."
