#!/usr/bin/env bash
set -euo pipefail

EXPECTED_CONFIRMATION="DELETE_DEDICATED_BINARY2048_TEST_ACCOUNT_DATA"
EXPECTED_STATE="artifacts/auth-deletion-dedicated/storage-state.json"
EXPECTED_BASE="https://www.binary2048.com"

if [[ "${ALLOW_PRODUCTION_DATA_DELETION:-}" != "${EXPECTED_CONFIRMATION}" ]]; then
  echo "Refusing destructive acceptance: set ALLOW_PRODUCTION_DATA_DELETION=${EXPECTED_CONFIRMATION}." >&2
  exit 1
fi

if [[ "${AUTH_DELETION_STORAGE_STATE:-}" != "${EXPECTED_STATE}" ]]; then
  echo "Refusing destructive acceptance: AUTH_DELETION_STORAGE_STATE must be ${EXPECTED_STATE}." >&2
  exit 1
fi

if [[ "${AUTH_BASE:-}" != "${EXPECTED_BASE}" ]]; then
  echo "Refusing destructive acceptance: AUTH_BASE must be ${EXPECTED_BASE}." >&2
  exit 1
fi

if [[ ! "${AUTH_DELETION_ACCOUNT_SHA256:-}" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Refusing destructive acceptance: provide the dedicated account identity SHA-256." >&2
  exit 1
fi

if [[ ! -f "${EXPECTED_STATE}" ]]; then
  echo "Dedicated deletion-test browser state is missing: ${EXPECTED_STATE}." >&2
  exit 1
fi

echo "Running destructive deletion acceptance against the confirmed dedicated test account."
npx playwright test --config=playwright.authenticated-deletion.config.ts
