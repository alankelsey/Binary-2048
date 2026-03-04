#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"

extract_json_field() {
  local json="$1"
  local field="$2"
  if command -v jq >/dev/null 2>&1; then
    echo "${json}" | jq -r "${field}"
  else
    echo "${json}" | sed -n "s/.*\"${field#'.'}\":\"\\([^\"]*\\)\".*/\\1/p"
  fi
}

echo "Auth-proof smoke: checking dev token endpoint..."
DEV_TOKEN_RESP="$(curl -fsS -X POST "${BASE}/api/auth/dev-token" -H "Content-Type: application/json" -d '{"sub":"smoke_paid","tier":"paid","entitlements":["extra_undos"],"ttlSeconds":120}')"
TOKEN="$(extract_json_field "${DEV_TOKEN_RESP}" '.token')"
if [[ -z "${TOKEN}" || "${TOKEN}" == "null" ]]; then
  echo "Failed to get dev auth token"
  echo "${DEV_TOKEN_RESP}"
  exit 1
fi

echo "Auth-proof smoke: minting entitlement proof..."
PROOF_RESP="$(curl -fsS -X POST "${BASE}/api/auth/entitlements/proof" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" -d '{"sessionClass":"ranked"}')"
PROOF="$(extract_json_field "${PROOF_RESP}" '.proof')"
if [[ -z "${PROOF}" || "${PROOF}" == "null" ]]; then
  echo "Failed to mint entitlement proof"
  echo "${PROOF_RESP}"
  exit 1
fi

echo "Auth-proof smoke: creating ranked game with proof..."
WITH_PROOF="$(curl -fsS -X POST "${BASE}/api/games" -H "Content-Type: application/json" -d "{\"economy\":{\"sessionClass\":\"ranked\",\"proof\":\"${PROOF}\"},\"config\":{\"spawn\":{\"pZero\":0.15,\"pOne\":0.55,\"pWildcard\":0.1,\"pLock\":0.2,\"wildcardMultipliers\":[2]}}}")"
if [[ "${WITH_PROOF}" != *'"lockTilesEnabled":true'* ]]; then
  echo "Expected ranked game with proof to keep lock tiles enabled"
  echo "${WITH_PROOF}"
  exit 1
fi

echo "Auth-proof smoke: creating ranked game from auth claims only..."
WITH_AUTH_CLAIMS="$(curl -fsS -X POST "${BASE}/api/games" -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" -d '{"economy":{"sessionClass":"ranked"},"config":{"spawn":{"pZero":0.15,"pOne":0.55,"pWildcard":0.1,"pLock":0.2,"wildcardMultipliers":[2]}}}')"
if [[ "${WITH_AUTH_CLAIMS}" != *'"lockTilesEnabled":true'* ]]; then
  echo "Expected ranked game with auth-bridge claims to keep lock tiles enabled"
  echo "${WITH_AUTH_CLAIMS}"
  exit 1
fi

echo "Auth-proof smoke test passed."
