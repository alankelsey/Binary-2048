#!/usr/bin/env bash
set -euo pipefail

PORT=4113
LOG_FILE="/tmp/binary2048-bot-tournament.log"
BASE_URL="${BASE:-http://localhost:${PORT}}"
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
  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

BASE="${BASE_URL}" npm run bot:tourney

echo "Bot tournament dev test passed."
