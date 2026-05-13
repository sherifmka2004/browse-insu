#!/usr/bin/env bash
set -euo pipefail

PW="npx --yes --package @playwright/cli playwright-cli --session redclick"

$PW open "https://www.redclick.ie/car-insurance" --headed
RUN_OUTPUT="$($PW run-code "$(cat scripts/flow_redclick.js)")"
printf '%s\n' "$RUN_OUTPUT"
if printf '%s\n' "$RUN_OUTPUT" | rg -q '^### Error'; then
  echo "Flow failed inside playwright run-code. Check latest snapshot and console logs." >&2
  exit 1
fi

$PW snapshot
LATEST_SNAPSHOT="$(ls -1t .playwright-cli/page-*.yml | head -n 1)"
node scripts/append_quote_summary.mjs "$LATEST_SNAPSHOT" "redclick.ie" "summary.csv"
