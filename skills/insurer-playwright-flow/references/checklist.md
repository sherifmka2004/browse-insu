# New Insurer Flow Checklist

## A. Discovery

- Confirm quote entry URL and whether it redirects to another domain.
- Identify cookie banner controls.
- Identify first 3 form steps and data dependencies.

## B. Script skeleton

- Create `scripts/flow_<insurer>.js`:
  - helper functions (`clickSafe`, `fillTextbox`, `clickContinue`, `visibleOrFirst`)
  - fail-fast anti-bot detector
  - deterministic data values from canonical profile
- Create `scripts/flow_<insurer>.sh`:
  - open headed browser
  - run-code from JS file
  - fail when `### Error` appears
  - snapshot + parser append

## C. Field mapping order

- Identity: name, DOB
- Vehicle: reg lookup/manual details
- History: licence, years held, NCB, claims/convictions
- Contact: phone, email
- Address: lookup first, manual fallback
- Drivers: additional driver choice
- Terms acceptance
- Price page

## D. Extraction mapping

Add insurer-specific regex extraction in `scripts/append_quote_summary.mjs`:

- quote reference
- policy start date
- comprehensive premium
- third-party fire & theft premium
- third-party only premium (if present)

## E. Validation

- Run `./scripts/flow_<insurer>.sh`.
- Confirm final URL is pricing/plans page.
- Confirm new CSV row is non-empty for core premium fields.
- Keep only successful rows (remove failed empty rows).
