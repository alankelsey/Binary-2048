#!/usr/bin/env bash
set -euo pipefail

PORT=4111
LOG_FILE="/tmp/binary2048-dev-smoke.log"
BASE="http://localhost:${PORT}"
DIST_DIR=".next-dev-${PORT}"
KEEP_DEV_DIST="${KEEP_DEV_DIST:-0}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  if [[ "${KEEP_DEV_DIST}" != "1" ]]; then
    rm -rf "${DIST_DIR}" >/dev/null 2>&1 || true
  fi
  bash ./scripts/normalize-next-env.sh >/dev/null 2>&1 || true
}
trap cleanup EXIT

NEXT_DIST_DIR="${DIST_DIR}" npm run dev:once -- -p "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 80); do
  if curl -fsS "${BASE}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

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
BAD_HASH_STATUS="$(curl -sS -o /tmp/binary2048-bad-hash.json -w "%{http_code}" -X POST "${BASE}/api/games/${GAME_ID}/move" -H "Content-Type: application/json" -d '{"action":"L","expectStateHash":"deadbeef"}')"
if [[ "${BAD_HASH_STATUS}" != "409" ]]; then
  echo "Dev smoke test failed: expected 409 on stale expectStateHash, got ${BAD_HASH_STATUS}"
  cat /tmp/binary2048-bad-hash.json || true
  exit 1
fi
curl -fsS -X POST "${BASE}/api/games/${GAME_ID}/undo" >/dev/null
EXPORT_RESP="$(curl -fsS "${BASE}/api/games/${GAME_ID}/export")"
if [[ "${EXPORT_RESP}" != *'"version":1'* && "${EXPORT_RESP}" != *'"version": 1'* ]]; then
  echo "Dev smoke test failed: /api/games/${GAME_ID}/export missing version field"
  exit 1
fi
curl -fsS -X POST "${BASE}/api/games/import" -H "Content-Type: application/json" -d "${EXPORT_RESP}" >/dev/null
curl -fsS -X POST "${BASE}/api/sim/run" -H "Content-Type: application/json" -d '{"config":{"width":4,"height":4,"seed":99,"winTile":2048,"zeroBehavior":"annihilate","spawnOnNoopMove":false,"spawn":{"pZero":0,"pOne":1,"pWildcard":0,"wildcardMultipliers":[2,4,8]}},"initialGrid":[[{"t":"w","m":2},{"t":"w","m":2},{"t":"n","v":1},null],[null,null,null,null],[null,null,null,null],[null,null,null,null]],"moves":["left"]}' >/dev/null
curl -fsS -X POST "${BASE}/api/simulate" -H "Content-Type: application/json" -d '{"seed":77,"moves":["left","up","right"],"config":{"size":4}}' >/dev/null

if grep -q "segment-explorer-node.js#SegmentViewNode" "${LOG_FILE}" || grep -q "React Client Manifest" "${LOG_FILE}"; then
  echo "Dev smoke test failed: detected React Client Manifest/segment-explorer error."
  echo "Log excerpt:"
  grep -n "segment-explorer-node.js#SegmentViewNode\|React Client Manifest" "${LOG_FILE}" | sed -n '1,40p'
  exit 1
fi

echo "Dev smoke test passed."
