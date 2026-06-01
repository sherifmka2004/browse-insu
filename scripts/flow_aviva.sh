#!/usr/bin/env bash
set -euo pipefail

PW="npx --yes --package @playwright/cli playwright-cli --session aviva"

$PW open "https://www.aviva.ie/" --headed

npx --yes --package @playwright/cli playwright-cli --session aviva run-code "$(cat scripts/flow_aviva.js)"

$PW snapshot
LATEST_SNAPSHOT="$(ls -1t .playwright-cli/page-*.yml | head -n 1)"
node scripts/append_quote_summary.mjs "$LATEST_SNAPSHOT" "aviva.ie" "summary.csv"
