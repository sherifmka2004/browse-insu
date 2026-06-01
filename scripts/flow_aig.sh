#!/usr/bin/env bash
set -euo pipefail

PW="npx --yes --package @playwright/cli playwright-cli --session aig"

CREATE_URL="https://www-417.aig.ie/brands/aigdirect/motor/createnewquote.aspx?enc=NUic3N57azQgnbRz7sSkmARMmeT5Dn0dTb7Vxycz0TCWiWNObn12%20JASL5rlzG5mkY10Ip3JD983o94%20XFOFQ/pNkAw7kLLLoOsyVZ8o3i4IZy/Z8WfK%20p1wRmPIznqu&PromoCode=AIG10"

$PW open "$CREATE_URL" --headed

RUN_OUTPUT="$($PW run-code "$(cat scripts/flow_aig.js)")"
if printf '%s\n' "$RUN_OUTPUT" | rg -q '^### Error'; then
  printf '%s\n' "$RUN_OUTPUT"
  echo "Flow failed inside playwright run-code. Check latest snapshot and console logs." >&2
  exit 1
fi
echo "AIG run-code completed."

# Snapshot comprehensive (default selection on the quote page)
$PW snapshot
COMP_SNAPSHOT="$(ls -1t .playwright-cli/page-*.yml | head -n 1)"

if rg -q 'unable to provide an online quotation|Quotation Result|No Quote' "$COMP_SNAPSHOT"; then
  POLICY_START_DATE="20/06/2026" \
    node scripts/append_quote_summary.mjs "$COMP_SNAPSHOT" "aig.ie" "summary.csv"
  exit 0
fi

# Switch to TPFT and snapshot again
cat <<'JS' > /tmp/aig_switch_tpft_for_flow.js
async (page) => {
  // Switch cover to TPFT and re-calculate. Then wait for premium to update.
  const price = page.getByRole('heading', { level: 2 }).first();
  const before = (await price.textContent())?.trim() || '';

  const coverSelect = page.getByRole('combobox').filter({ hasText: /Comprehensive|TPFT/ }).first();
  await coverSelect.selectOption({ label: 'TPFT' });
  await page.getByRole('link', { name: /Re-calculate/i }).click();

  await page.waitForFunction(
    (prev) => {
      const h2 = document.querySelector('h2');
      return !!h2 && (h2.textContent || '').trim() !== prev;
    },
    before,
    { timeout: 60000 }
  );
}
JS

TPFT_OUTPUT="$($PW run-code "$(cat /tmp/aig_switch_tpft_for_flow.js)")"
if printf '%s\n' "$TPFT_OUTPUT" | rg -q '^### Error'; then
  printf '%s\n' "$TPFT_OUTPUT"
  echo "Failed switching AIG cover to TPFT. Not appending CSV." >&2
  exit 1
fi
echo "AIG TPFT recalculation completed."

$PW snapshot
TPFT_SNAPSHOT="$(ls -1t .playwright-cli/page-*.yml | head -n 1)"

POLICY_START_DATE="20/06/2026" \
  node scripts/append_quote_summary.mjs "${COMP_SNAPSHOT},${TPFT_SNAPSHOT}" "aig.ie" "summary.csv"
