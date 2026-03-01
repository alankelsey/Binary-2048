#!/usr/bin/env bash
set -euo pipefail

stopping=0
child_pid=""

on_stop() {
  stopping=1
  if [[ -n "${child_pid}" ]]; then
    kill "${child_pid}" >/dev/null 2>&1 || true
  fi
}

trap on_stop INT TERM

while true; do
  NEXT_DIST_DIR=.next-dev NEXT_DISABLE_WEBPACK_CACHE=1 npx next dev "$@" &
  child_pid=$!
  wait "${child_pid}" || exit_code=$?
  exit_code="${exit_code:-0}"
  child_pid=""

  if [[ "${stopping}" -eq 1 ]]; then
    exit 0
  fi

  if [[ "${exit_code}" -eq 0 ]]; then
    exit 0
  fi

  echo "next dev exited with code ${exit_code}; restarting in 1s..." >&2
  sleep 1
  unset exit_code
done
