#!/usr/bin/env bash
set -euo pipefail

PORT=4113
LOG_FILE="/tmp/binary2048-bot-tournament.log"
BASE_URL="${BASE:-http://localhost:${PORT}}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

npm run dev:once -- -p "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 80); do
  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

BASE="${BASE_URL}" npm run bot:tourney

echo "Bot tournament dev test passed."
