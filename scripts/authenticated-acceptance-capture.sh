#!/usr/bin/env bash
set -euo pipefail

BASE="${AUTH_BASE:-${PROD_BASE:-https://main.dzxvs1esr22z9.amplifyapp.com}}"
STATE="${AUTH_STORAGE_STATE:-artifacts/auth-acceptance/storage-state.json}"
mkdir -p "$(dirname "${STATE}")"

echo "Opening ${BASE}/auth for a one-time real GitHub sign-in."
echo "Complete GitHub login/MFA, confirm 'Authenticated: yes', then close the browser."
echo "The resulting cookie state is sensitive, local-only, and ignored by Git."
npx playwright codegen --browser=chromium --save-storage="${STATE}" "${BASE}/auth"
echo "Saved authenticated browser state to ${STATE}"
