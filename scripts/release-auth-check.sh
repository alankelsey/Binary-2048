#!/usr/bin/env bash
set -euo pipefail

BASE="${PROD_BASE:-https://www.binary2048.com}"
CURL_OPTS=(--connect-timeout 8 --max-time 20)

check_endpoint() {
  local path="$1"
  local expected="$2"
  local url="${BASE}${path}"
  local headers_file
  local body_file
  headers_file="$(mktemp)"
  body_file="$(mktemp)"

  curl -sS "${CURL_OPTS[@]}" -D "${headers_file}" -o "${body_file}" "${url}" || true
  local status
  status="$(awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "${headers_file}")"
  rm -f "${headers_file}"

  if [[ -z "${status}" ]]; then
    echo "release auth check failed: ${path} had no HTTP status"
    rm -f "${body_file}"
    exit 1
  fi

  if [[ "${status}" == "500" ]]; then
    echo "release auth check failed: ${path} returned 500"
    sed -n '1,40p' "${body_file}"
    rm -f "${body_file}"
    exit 1
  fi

  if [[ "${expected}" == "200_or_302" ]]; then
    if [[ "${status}" != "200" && "${status}" != "302" ]]; then
      echo "release auth check failed: ${path} expected 200/302, got ${status}"
      sed -n '1,40p' "${body_file}"
      rm -f "${body_file}"
      exit 1
    fi
  elif [[ "${status}" != "${expected}" ]]; then
    echo "release auth check failed: ${path} expected ${expected}, got ${status}"
    sed -n '1,40p' "${body_file}"
    rm -f "${body_file}"
    exit 1
  fi

  if grep -qiE 'NO_SECRET|MissingSecretError|There is a problem with the server configuration' "${body_file}"; then
    echo "release auth check failed: ${path} response contains auth secret/server config error signature"
    sed -n '1,80p' "${body_file}"
    rm -f "${body_file}"
    exit 1
  fi

  rm -f "${body_file}"
  echo "ok ${path} status=${status}"
}

echo "Running release auth/session checks against: ${BASE}"
check_endpoint "/auth" "200"
check_endpoint "/api/auth/signin" "200_or_302"
check_endpoint "/api/auth/session" "200"
echo "Release auth/session checks passed."
