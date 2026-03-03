#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DIST_ID="${DIST_ID:-}"
DO_CHECK_WAF="${DO_CHECK_WAF:-1}"
DO_CHECK_TRIPWIRE="${DO_CHECK_TRIPWIRE:-1}"

PASS=0
FAIL=0

run_step() {
  local label="$1"
  shift
  echo "==> ${label}"
  if "$@"; then
    PASS=$((PASS + 1))
    echo "PASS: ${label}"
  else
    FAIL=$((FAIL + 1))
    echo "FAIL: ${label}"
  fi
  echo
}

if [[ "${DO_CHECK_WAF}" == "1" ]]; then
  if [[ -z "${DIST_ID}" ]]; then
    echo "warning: DIST_ID not set, skipping WAF policy check."
  else
    run_step "WAF policy check" bash "${ROOT_DIR}/scripts/waf-check.sh"
  fi
fi

if [[ "${DO_CHECK_TRIPWIRE}" == "1" ]]; then
  run_step "Billing tripwire check" bash "${ROOT_DIR}/scripts/waf-tripwire-check.sh"
fi

echo "Doctor summary: ${PASS} passed, ${FAIL} failed"
if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi
