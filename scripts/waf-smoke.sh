#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DIST_ID="${DIST_ID:-}"
APP_DOMAIN="${APP_DOMAIN:-}"

if [[ -z "${DIST_ID}" ]]; then
  echo "error: DIST_ID is required (CloudFront distribution id, e.g. E123ABC456XYZ)" >&2
  echo "usage: DIST_ID=E123ABC456XYZ [APP_DOMAIN=binary2048.com] npm run ops:waf:smoke" >&2
  exit 1
fi

if [[ -n "${APP_DOMAIN}" ]]; then
  echo "==> Discover (filtered by APP_DOMAIN=${APP_DOMAIN})"
  APP_DOMAIN="${APP_DOMAIN}" bash "${ROOT_DIR}/scripts/waf-discover.sh"
  echo
fi

echo "==> Status"
DIST_ID="${DIST_ID}" bash "${ROOT_DIR}/scripts/waf-status.sh"
echo

echo "==> Policy check"
DIST_ID="${DIST_ID}" bash "${ROOT_DIR}/scripts/waf-check.sh"
echo

echo "==> Doctor"
DIST_ID="${DIST_ID}" bash "${ROOT_DIR}/scripts/waf-doctor.sh"
echo

echo "WAF smoke complete."
