#!/usr/bin/env bash
set -euo pipefail

BASE="${PROD_BASE:-https://www.binary2048.com}"
REQUESTS="${REGIONAL_CHECK_REQUESTS:-8}"
POPS_OUT="${REGIONAL_POPS_OUT:-}"
CURL_OPTS=(--connect-timeout 8 --max-time 20)

if ! command -v awk >/dev/null 2>&1; then
  echo "awk is required." >&2
  exit 1
fi

echo "Running regional/POP probe against ${BASE}"
tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

for i in $(seq 1 "${REQUESTS}"); do
  headers="$(mktemp)"
  curl -sS "${CURL_OPTS[@]}" -D "${headers}" -o /dev/null "${BASE}/" || true
  pop="$(awk -F': ' 'tolower($1)=="x-amz-cf-pop"{print $2}' "${headers}" | tr -d '\r' | tail -n 1)"
  status="$(awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "${headers}")"
  rm -f "${headers}"
  echo "req=${i} status=${status:-000} pop=${pop:-unknown}" | tee -a "${tmp}"
done

unique_pop_count="$(
  awk '
    {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^pop=/) {
          split($i, a, "=");
          seen[a[2]] = 1;
        }
      }
    }
    END {
      c = 0;
      for (k in seen) {
        if (k != "unknown" && k != "") c++;
      }
      print c;
    }
  ' "${tmp}"
)"
echo "unique_pop_count=${unique_pop_count}"

if [[ -n "${POPS_OUT}" ]]; then
  awk '
    {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^pop=/) {
          split($i, a, "=");
          if (a[2] != "unknown" && a[2] != "") print a[2];
        }
      }
    }
  ' "${tmp}" | sort -u > "${POPS_OUT}"
fi

if [[ "${unique_pop_count}" -lt 1 ]]; then
  echo "Regional check failed: could not detect any CloudFront POP headers in this region."
  exit 1
fi

echo "Regional/POP probe complete."
echo "NOTE: this script validates one execution region; use matrix workflows for multi-region validation."
