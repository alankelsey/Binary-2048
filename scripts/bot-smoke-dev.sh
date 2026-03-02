#!/usr/bin/env bash
set -euo pipefail

PORT=4112
LOG_FILE="/tmp/binary2048-bot-smoke.log"
BASE_URL="${BASE:-http://localhost:${PORT}}"
DIST_DIR=".next-dev-${PORT}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  rm -rf "${DIST_DIR}" >/dev/null 2>&1 || true
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

BASE="${BASE_URL}" npm run bot:smoke

echo "Bot smoke dev test passed."
