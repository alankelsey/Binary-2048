#!/usr/bin/env bash
set -euo pipefail

BASE="${PROD_BASE:-https://www.binary2048.com}"
ARTIFACT_DIR="${PROD_FINGERPRINT_ARTIFACT_DIR:-artifacts}"
RUN_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${ARTIFACT_DIR}/prod-digest-fingerprints-${RUN_STAMP}.json"
DEPLOY_JOB_ID="${AMPLIFY_JOB_ID:-unknown}"
DEPLOY_COMMIT_ID="${AMPLIFY_COMMIT_ID:-unknown}"

mkdir -p "${ARTIFACT_DIR}"

if ! command -v jq >/dev/null 2>&1; then
  echo "prod digest scan requires jq" >&2
  exit 1
fi

ENDPOINTS=("/" "/auth" "/api/auth/signin")
TMP_JSON="$(mktemp)"
trap 'rm -f "${TMP_JSON}"' EXIT

jq -n \
  --arg base "${BASE}" \
  --arg deployJobId "${DEPLOY_JOB_ID}" \
  --arg deployCommitId "${DEPLOY_COMMIT_ID}" \
  --arg scannedAt "${RUN_STAMP}" \
  '{base:$base,deployJobId:$deployJobId,deployCommitId:$deployCommitId,scannedAt:$scannedAt,records:[]}' > "${TMP_JSON}"

for endpoint in "${ENDPOINTS[@]}"; do
  url="${BASE}${endpoint}"
  headers_file="$(mktemp)"
  body_file="$(mktemp)"

  curl -sS -D "${headers_file}" -o "${body_file}" "${url}" || true
  status="$(awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "${headers_file}")"
  if [[ -z "${status}" ]]; then
    status="000"
  fi

  digest_lines="$(grep -Eo 'Digest:[[:space:]]*[0-9]+' "${body_file}" | sed -E 's/.*Digest:[[:space:]]*//' || true)"
  if [[ -z "${digest_lines}" ]]; then
    digest_lines="$(grep -Eo "digest:[[:space:]]*'[0-9]+'" "${body_file}" | sed -E "s/.*'([0-9]+)'.*/\\1/" || true)"
  fi

  if [[ -n "${digest_lines}" ]]; then
    while IFS= read -r digest; do
      if [[ -z "${digest}" ]]; then
        continue
      fi
      jq \
        --arg endpoint "${endpoint}" \
        --arg url "${url}" \
        --arg status "${status}" \
        --arg digest "${digest}" \
        --arg fingerprint "digest:${digest}" \
        --arg detectedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '.records += [{endpoint:$endpoint,url:$url,status:($status|tonumber),digest:$digest,fingerprint:$fingerprint,detectedAt:$detectedAt}]' \
        "${TMP_JSON}" > "${TMP_JSON}.next"
      mv "${TMP_JSON}.next" "${TMP_JSON}"
    done <<< "${digest_lines}"
  elif [[ "${status}" -ge 500 ]]; then
    jq \
      --arg endpoint "${endpoint}" \
      --arg url "${url}" \
      --arg status "${status}" \
      --arg fingerprint "status:${status}:no-digest" \
      --arg detectedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '.records += [{endpoint:$endpoint,url:$url,status:($status|tonumber),fingerprint:$fingerprint,detectedAt:$detectedAt}]' \
      "${TMP_JSON}" > "${TMP_JSON}.next"
    mv "${TMP_JSON}.next" "${TMP_JSON}"
  fi

  rm -f "${headers_file}" "${body_file}"
done

jq '.records |= (unique_by(.endpoint + ":" + .fingerprint))' "${TMP_JSON}" > "${OUT_FILE}"
COUNT="$(jq '.records | length' "${OUT_FILE}")"

echo "Prod digest fingerprint scan complete."
echo "output=${OUT_FILE}"
echo "deploy_job_id=${DEPLOY_JOB_ID}"
echo "deploy_commit_id=${DEPLOY_COMMIT_ID}"
echo "fingerprints_found=${COUNT}"

if [[ "${COUNT}" -gt 0 ]]; then
  echo "Detected error fingerprints:"
  jq -r '.records[] | "- \(.endpoint) fingerprint=\(.fingerprint) status=\(.status)"' "${OUT_FILE}"
fi
