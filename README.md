# browse-insu

End-to-end automation for Irish car insurance quote forms. Parses unstructured user data into a canonical JSON payload, then drives Playwright to navigate and fill quote forms on insurer websites.

## Supported Insurers

| Insurer | Domain | Playwright Flow |
|---|---|---|
| 123.ie | 123.ie | ✅ implemented |
| Aviva | aviva.ie | ✅ implemented |
| AIG Direct | aigdirect.ie | ✅ implemented |
| Redclick | redclick.ie | ✅ implemented |
| Zurich | zurich.ie | ✅ implemented |
| AA Ireland | aa.ie | ⬜ mapping only |
| Chill Insurance | chill.ie | ⬜ mapping only |
| SuperValu Insurance | supervalu.ie | ⬜ mapping only |
| An Post Insurance | anpost.ie | ⬜ mapping only |
| Allianz | allianz.ie | ⬜ mapping only |

## How It Works

```
Raw text input (vehicle, driver, policy details)
        ↓
   [Parser]  →  CanonicalData (structured JSON)
        ↓
   [Fill Plan Builder]  →  ordered list of form actions
        ↓
   [Playwright flow script]  →  navigates & fills the insurer's quote form
        ↓
   Quote pricing page  →  result appended to summary.csv
```

### CanonicalData fields

| Group | Fields |
|---|---|
| vehicle | year, make, model, registration, purchase_date, estimated_value_eur |
| policy | use, annual_mileage_km, cover_start_date |
| licence | type, years_held, penalty_points, convictions |
| claims | ncb_years, claims_last_2_years |
| driver | title, first_name, last_name, date_of_birth, occupation, additional_drivers |
| contact | address_line1, town, county, eircode, phone, email |

## Install

```bash
npm install
```

## Usage

Parse input text and print canonical JSON:

```bash
cat input.txt | npm run parse
```

Parse and generate a fill plan for a specific insurer:

```bash
cat input.txt | npm run parse -- --insurer aviva
```

Read from file:

```bash
npm run parse -- --file ./input.txt --insurer zurich
```

Run a Playwright flow directly:

```bash
node scripts/flow_aviva.js
node scripts/flow_123.js
node scripts/flow_aig.js
node scripts/flow_redclick.js
node scripts/flow_zurich.js
```

Results are appended to `summary.csv`.

## Project Structure

```
src/
  parser.ts       — converts raw text into CanonicalData
  types.ts        — TypeScript interfaces (CanonicalData, FillPlan, FillAction, InsurerKey)
  mapping.ts      — per-insurer field mappings (canonical field → form selector/label)
  fill-plan.ts    — builds ordered FillAction list with value transforms
  cli.ts          — CLI entry point
  index.ts        — public API exports
  utils.ts        — date, money, address, name parsing helpers

scripts/
  flow_aviva.js   — Aviva quote form automation
  flow_123.js     — 123.ie quote form automation
  flow_aig.js     — AIG Direct quote form automation (includes bot/TrustArc handling)
  flow_redclick.js — Redclick quote form automation
  flow_zurich.js  — Zurich quote form automation (React-select, reCAPTCHA detection)
  append_quote_summary.mjs — appends quote results to summary.csv
```

## Value Transforms

The fill-plan builder applies these transforms before injecting values into form actions:

| Transform | Output |
|---|---|
| `date_dmy` | `{ day, month, year }` object |
| `date_dmy_slashes` | `DD/MM/YYYY` string |
| `date_month_year` | `December 2017` |
| `date_label_long` | `20, April 2026` |
| `bool_yes_no` | `Yes` / `No` |
| `euros` | formatted euro amount |
| `km` | mileage string |

## Notes

- Dates are parsed in `DD/MM/YYYY` format (Irish default).
- Month/year inputs like `Dec 2017` default to day `01` and emit a warning.
- All flows stop at the final quote/pricing page — they do not purchase.
- Flow scripts handle common obstacles: cookie banners, bot challenge detection, address search fallback, occupation autocomplete.
- To add a new insurer: add its key to `InsurerKey` in `types.ts`, add field mappings in `mapping.ts`, and follow the workflow in `skills/insurer-playwright-flow/SKILL.md`.
