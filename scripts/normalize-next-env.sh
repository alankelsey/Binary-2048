#!/usr/bin/env bash
set -euo pipefail

FILE="next-env.d.ts"
if [[ ! -f "${FILE}" ]]; then
  exit 0
fi

cat >"${FILE}" <<'EOF'
/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next-build/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
EOF
