#!/usr/bin/env bash
set -euo pipefail

STATE="${AUTH_STORAGE_STATE:-artifacts/auth-acceptance/storage-state.json}"
if [[ ! -f "${STATE}" ]]; then
  echo "Authenticated browser state is missing: ${STATE}" >&2
  echo "Run npm run ops:auth:capture and complete the provider login first." >&2
  exit 1
fi

npx playwright test --config=playwright.authenticated.config.ts
