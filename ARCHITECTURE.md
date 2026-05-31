# Architecture & System Design

This document is the authoritative reference for the `browse-insu` system. It is written for LLMs and engineers who need to understand, debug, extend, or add new insurers without reading every source file from scratch.

---

## Purpose

`browse-insu` automates Irish car insurance quote forms. Given raw text describing a driver, vehicle, and policy, it:

1. Parses the text into a canonical JSON structure.
2. Maps that structure to per-insurer form fields.
3. Drives a Playwright browser session to navigate, fill, and submit each insurer's quote form.
4. Extracts the quoted prices from the final pricing page and appends them to `summary.csv`.

The system is scoped to the **Irish market** (eircode addresses, DD/MM/YYYY dates, euro amounts, Irish licence types).

---

## System Layers

```
┌─────────────────────────────────────────────────────┐
│  Layer 1 – Parsing (TypeScript)                     │
│  src/parser.ts + src/utils.ts                       │
│  Input: raw text  →  Output: CanonicalData JSON     │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  Layer 2 – Mapping + Fill Plan (TypeScript)         │
│  src/mapping.ts + src/fill-plan.ts                  │
│  Input: CanonicalData + InsurerKey                  │
│  Output: ordered list of FillActions                │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  Layer 3 – Playwright Automation (JavaScript)       │
│  scripts/flow_<insurer>.js                          │
│  Input: page (Playwright Page object)               │
│  Output: final quote pricing page visible           │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│  Layer 4 – Quote Extraction (Node.js)               │
│  scripts/append_quote_summary.mjs                   │
│  Input: .playwright-cli/page-*.yml snapshot file    │
│  Output: one appended row in summary.csv            │
└─────────────────────────────────────────────────────┘
```

---

## Layer 1 – Parsing

### Entry point

`src/cli.ts` reads `--file <path>` or stdin, calls `parseUserText()`, and prints JSON to stdout.

```bash
cat input.txt | npm run parse
npm run parse -- --file ./input.txt --insurer aviva
```

### `parseUserText(input, parsedAt?)` → `ParseResult`

Defined in `src/parser.ts`. Splits input by newline, normalises each line (strips emojis, leading non-alphanumeric chars, collapses whitespace), then dispatches each line to a sub-parser based on a keyword match:

| Keyword in line | Sub-parser |
|---|---|
| `vehicle:` | `parseVehicleLine` |
| `use:` / `mileage:` / `cover start` | `parsePolicyLine` |
| `licence:` / `license:` | `parseLicenceLine` |
| `ncb:` | `parseNcbLine` |
| `driver:` | `parseDriverLine` |
| `address:` | `parseAddressLine` |
| `phone:` / `email:` | `parseContactLine` |
| `additional driver` | `parseAdditionalDriversLine` |

Lines that match no keyword are pushed to `unknown_lines`. After the loop, email and phone are extracted as a fallback from the full text using regex.

### Input format conventions

- `vehicle:` — `<year> <make> <model>, reg: <reg>[, purchased <date>][, value <amount>]`
- `use: … | mileage: … | cover start: …` — pipe `|` separates policy segments on one line
- `licence: <type>, <N> years held, [no] penalty points, [no] convictions`
- `ncb: <N>, [no] claims last 2 years`
- `driver: <title> <first> <last>, dob <date>, <occupation>`
- `address: <line1>, <town>, <county>, <eircode>`
- `phone: … | email: …` — pipe separates contact segments on one line
- `no additional drivers` / `additional drivers`

### Date parsing (`src/utils.ts → parseDate`)

Accepts three formats:
- `DD/MM/YYYY` or `DD-MM-YYYY`
- `YYYY/MM/DD` or `YYYY-MM-DD`
- `Mon YYYY` (e.g. `Dec 2017`) — day defaults to `01` and a warning is emitted

All dates are stored as ISO strings (`YYYY-MM-DD`) in `CanonicalData`.

### `ParseResult` shape

```ts
{
  data: CanonicalData,    // structured fields
  warnings: string[],     // non-fatal issues (missing phone, defaulted day)
  errors: string[],       // reserved for fatal parse errors
  unknown_lines: string[] // lines that matched no keyword
}
```

---

## Layer 2 – Mapping and Fill Plan

### `CanonicalData` (src/types.ts)

All dates are `YYYY-MM-DD` strings. All amounts are numbers (euros). Booleans for `convictions` and `additional_drivers`.

```
vehicle:  year, make, model, registration, purchase_date, estimated_value_eur
policy:   use, annual_mileage_km, cover_start_date
licence:  type, years_held, penalty_points, convictions
claims:   ncb_years, claims_last_2_years
driver:   title, first_name, last_name, date_of_birth, occupation, additional_drivers
contact:  address_line1, town, county, eircode, phone, email
meta:     source_text_language, parsed_at
```

### `FieldMapping` (src/types.ts)

Each mapping ties one `CanonicalFieldPath` to one or more `FillTarget`s:

```ts
{
  valueFrom: CanonicalFieldPath,  // e.g. "driver.date_of_birth"
  required?: boolean,
  transform?: TransformId,        // optional value transformation
  targets: FillTarget[],          // one or more form actions
  note?: string
}
```

A `FillTarget` describes a single DOM interaction:

```ts
{
  selector?: string,              // CSS / Playwright locator; supports {{value}} placeholder
  label?: string,                 // human label for warnings when selector is missing
  inputType: InputType,           // "text" | "select" | "radio" | "checkbox" | "click"
  valueKey?: "day" | "month" | "year",  // used when transform produces a SplitDate object
  optionMap?: Record<string, string>,   // canonical value → form option text
  note?: string
}
```

### Transforms (src/fill-plan.ts → `applyTransform`)

| TransformId | Input | Output |
|---|---|---|
| `date_dmy` | `"1988-03-15"` | `{ day: "15", month: "03", year: "1988" }` |
| `date_dmy_slashes` | `"1988-03-15"` | `"15/03/1988"` |
| `date_month_year` | `"2017-12-01"` | `"December 2017"` |
| `date_label_long` | `"2026-04-20"` | `"20, April 2026"` |
| `bool_yes_no` | `true` / `false` | `"Yes"` / `"No"` |
| `bool_true_false` | `true` / `false` | `"true"` / `"false"` |
| `upper` | any string | uppercased |
| `lower` | any string | lowercased |
| `euros` | number | rounded integer string |
| `km` | number | rounded integer string |
| `number` | number or string | digits only |
| `trim` | string | trimmed |

When `date_dmy` is used, the single field expands into **three** `FillTarget`s, each with a `valueKey` of `"day"`, `"month"`, or `"year"`.

### `buildFillPlan(data, insurer)` → `FillPlan`

Iterates all `FieldMapping`s for the given insurer, resolves each value, applies transforms, substitutes `{{value}}` in selectors, and collects `FillAction`s. Emits warnings for missing required fields or targets without selectors.

```ts
FillAction {
  insurer: InsurerKey,
  fieldPath: CanonicalFieldPath,
  selector: string,
  inputType: InputType,
  value: string,
  note?: string
}
```

### `insurerFieldMaps` (src/mapping.ts)

`baseFields` defines the default mapping for every field using labels only (no selectors). This is the baseline for all insurers.

`"123"` is the only insurer with full selector overrides. All other insurers (`redclick`, `zurich`, `aviva`, `aa`, `chill`, `supervalu`, `anpost`, `allianz`) reference `baseFields` unchanged — their automation is handled entirely in the Playwright flow scripts rather than the mapping layer.

### Insurer aliases (src/mapping.ts → `insurerAliases`)

The CLI accepts loose names: `"chill insurance"` → `"chill"`, `"an post"` → `"anpost"`, `"zurick"` → `"zurich"`.

---

## Layer 3 – Playwright Flow Scripts

Each `scripts/flow_<insurer>.js` is a **self-contained async function expression** evaluated by `playwright-cli run-code`. It receives a single argument: `page` (a Playwright `Page` object).

### Execution model

```bash
npx --yes --package @playwright/cli playwright-cli \
  --session <insurer> run-code "$(cat scripts/flow_<insurer>.js)"
```

The `--session` flag gives the browser a named persistent context (cookies, local storage survive between runs). All scripts use the same hardcoded test data (see data objects inside each script).

### Common helpers pattern

Every flow script defines local async helper functions. The pattern is consistent across scripts:

| Helper | Purpose |
|---|---|
| `clickSafe(locator)` | wait for visible, click, force-click as fallback |
| `fillTextbox(name, value)` | `getByRole("textbox", { name })` then `fill()` |
| `typeLikeUser(name, value)` | types character by character (for autocomplete inputs) |
| `chooseRadio(question, answer)` | finds radio by heading + label, falls back to global search |
| `clickContinue()` | clicks the last visible "Continue" button/link |
| `pause(ms)` | `page.waitForTimeout(ms)` — use only after autocomplete/animation |

### Per-insurer flow details

#### `flow_123.js`
- Uses `(async () => { ... })()` (IIFE, unlike the others which use a plain `async (page) =>`)
- Selector-driven: fills inputs by `placeholder` attribute
- Date picker for cover start: navigates calendar months, clicks exact date button (e.g. `"20, April 2026"`)
- Address: Eircode autocomplete, then clicks the first matching suggestion text
- Stops at the "Get your price" pricing page

#### `flow_aviva.js`
- Uses `async (page) =>` expression
- Navigate to `insurance.aviva.ie/products/Car/CreateNewQuote.aspx`
- URL-based page transitions: `waitForURL(/quote-your-details|...)` after each continue
- Occupation: type `"house"` into autocomplete, pick "Housewife" / "Housekeeper" / first option
- Address: tries address search first; if no fields appear, falls back to manual entry (`"Can't find your address"` → `"Enter manually"`)
- Cover type: selects "Comprehensive" radio
- Terms: checks terms checkbox before submitting
- Stops at `quote-summary` / `view-your-quote` URL

#### `flow_aig.js`
- Uses `async (page) =>` expression
- Navigate to `www-417.aig.ie/brands/aigdirect/motor/createnewquote.aspx`
- Handles **two** cookie banners: AIG marketing banner and TrustArc `#truste-consent-required`
- Bot detection: if "Are you a robot / CAPTCHA" text appears, throws with a message requiring manual intervention
- 8-step accordion form; each step has a numbered continue button (`#ctl00_Main_Continue1` … `#ctl00_Main_btnContinue9`)
- Address: tries Eircode lookup first; if it fails, clicks "Cannot find address" and uses the manual form (Address 1, Address 2, County dropdown, Sub Area dropdown, Postcode)
- Uses `page.evaluate()` to dispatch events on hidden/frozen radio inputs
- Supports an optional promo code (`AIG10`)
- Stops at `quoteplus.aspx` or `noquote.aspx`

#### `flow_redclick.js`
- Uses `async (page) =>` expression
- Navigate to `redclick.ie`
- Similar structure to Aviva: role/label selectors, bot detection check
- Address search with Eircode fallback to manual entry
- Stops at the final plan selection / pricing page

#### `flow_zurich.js`
- Uses `async (page) =>` expression
- Navigate to `quote.zurich.ie`
- Single-page React app — form does not navigate between URLs
- Uses `selectReactOption({ rootSelector, inputSelector, query, optionText })` for React-select dropdowns
- Uses `fillById(id, value)` for standard inputs identified by their HTML `id`
- Uses `setChecked(selector)` which tries `check({ force: true })` then falls back to `page.evaluate()` dispatching DOM events
- reCAPTCHA detection: attempts to click the iframe checkbox before submission
- `clickNext()` uses `page.evaluate()` to find and click the "Next" button by visible text, throws with diagnostics if not found
- After submission, waits for `#Motor-Vehicle-VehicleRegistrationNumber` to become hidden (confirms page transition)
- Handles optional "Declarations" page between form submission and pricing page
- Stops when `document.body.innerText` contains both "Comprehensive", "third party", and a `€NNN.NN` price pattern

### Anti-bot and overlay handling rules

1. Always call `acceptCookiesIfPresent()` or equivalent before the first substantive click.
2. For hidden/covered elements: try `click({ force: true })` first, then `page.evaluate()` with DOM event dispatch.
3. When multiple matching elements exist, prefer `.first()` that `isVisible()` — see `visibleOrFirst()` helper.
4. After any postback (especially on AIG's ASP.NET accordion), wait briefly (`waitForTimeout(300–800)`) or wait for a known element before proceeding.
5. On bot challenge detection: throw with a clear message rather than silently failing.

---

## Layer 4 – Quote Extraction

`scripts/append_quote_summary.mjs` parses a `.playwright-cli/page-*.yml` snapshot file (Playwright CLI's YAML page dump) and appends one row to `summary.csv`.

### Usage

```bash
node scripts/append_quote_summary.mjs <snapshot.yml> [insurer] [csv_path]
# Multiple snapshots (AIG Comp + TPFT):
node scripts/append_quote_summary.mjs snapshot1.yml,snapshot2.yml aig.ie
# Auto-detect insurer from snapshot content:
node scripts/append_quote_summary.mjs snapshot.yml auto
```

### Insurer detection

If insurer is `"auto"` or `"detect"`, the script inspects the snapshot text for known signatures:

| Signature | Detected as |
|---|---|
| `Select a plan to get started` / `Quote reference:` | `redclick.ie` |
| `Government Levy:` / `No Claims Bonus:` / `123.ie` | `123.ie` |
| `AIG Deluxe` / `AIG Direct` / `Quote Reference: <8+ digits>` | `aig.ie` |
| `Q-PC-\d+` / `quote.zurich.ie` / `ZurichDirect` | `zurich.ie` |

### CSV schema

Every row has these columns:

| Column | Description |
|---|---|
| `extracted_at` | ISO timestamp of extraction |
| `insurer` | normalised insurer key |
| `snapshot_file` | basename(s) of the source snapshot(s) |
| `quote_status` | `priced` / `no_quote_online` / `unknown` |
| `notes` | human note (e.g. AIG fallback message) |
| `quote_reference` | insurer quote ID |
| `policy_start_date` | `DD/MM/YYYY` |
| `comprehensive_annual_eur` | numeric |
| `third_party_fire_theft_annual_eur` | numeric |
| `third_party_only_annual_eur` | numeric |
| `pay_in_full_savings_eur` | numeric (123 only) |
| `ncb_discount_eur` | numeric (123 only) |
| `online_discount_eur` | numeric (123 only) |
| `government_levy_eur` | numeric (123 only) |
| `quote_valid_today` | `yes` / `no` (123 only) |
| `session_minutes_left` | integer (123 only) |

---

## Supported Insurers – Implementation Status

| InsurerKey | Aliases | Flow script | Mapping selectors | Extraction |
|---|---|---|---|---|
| `123` | `123` | ✅ `flow_123.js` | ✅ full selectors | ✅ `extract123()` |
| `aviva` | `aviva` | ✅ `flow_aviva.js` | ⬜ labels only | ⬜ not implemented |
| `redclick` | `redclick` | ✅ `flow_redclick.js` | ⬜ labels only | ✅ `extractRedclick()` |
| `zurich` | `zurich`, `zurick` | ✅ `flow_zurich.js` | ⬜ labels only | ✅ `extractZurich()` |
| `aa` | `aa` | ⬜ not started | ⬜ labels only | ⬜ not implemented |
| `chill` | `chill`, `chill insurance` | ⬜ not started | ⬜ labels only | ⬜ not implemented |
| `supervalu` | `supervalu` | ⬜ not started | ⬜ labels only | ⬜ not implemented |
| `anpost` | `anpost`, `an post` | ⬜ not started | ⬜ labels only | ⬜ not implemented |
| `allianz` | `allianz` | ⬜ not started | ⬜ labels only | ⬜ not implemented |

> AIG (`aig`) is implemented in `flow_aig.js` and `extractAig()` but does **not** have an `InsurerKey` entry in `types.ts` or a mapping entry — it is driven entirely by the flow script.

---

## How to Add a New Insurer

Follow these steps to bring a new insurer from zero to a working flow.

### Step 1 – Register the insurer key

In `src/types.ts`, add the key to `InsurerKey`:

```ts
export type InsurerKey =
  | "123"
  | "newinsurer"   // ← add here
  | ...
```

### Step 2 – Add aliases and mapping

In `src/mapping.ts`:

```ts
export const insurerAliases: Record<string, InsurerKey> = {
  newinsurer: "newinsurer",
  "new insurer": "newinsurer",   // handle common variants
  ...
};

export const insurerFieldMaps: Record<InsurerKey, FieldMapping[]> = {
  ...
  newinsurer: baseFields,   // start with baseFields; add selector overrides as you discover them
};
```

### Step 3 – Create the flow script

Create `scripts/flow_newinsurer.js` as a plain `async (page) => { ... }` expression (not an IIFE). Follow the standard helpers pattern:

```js
async (page) => {
  const timeout = 30000;

  // define: clickSafe, fillTextbox, typeLikeUser, chooseRadio, clickContinue, visibleOrFirst

  // 1. Navigate if not already on the quote URL
  // 2. Accept cookies
  // 3. Check for bot challenges
  // 4. Walk form steps, using role/label selectors first
  // 5. Handle address lookup + manual fallback
  // 6. Stop at pricing page — do NOT proceed past it
}
```

Create `scripts/flow_newinsurer.sh` to run it:

```bash
#!/usr/bin/env bash
set -euo pipefail
npx --yes --package @playwright/cli playwright-cli \
  --session newinsurer run-code "$(cat scripts/flow_newinsurer.js)"
```

### Step 4 – Add quote extraction

In `scripts/append_quote_summary.mjs`:

1. Add a detection signature to `normalizeInsurer()`.
2. Add an `extractNewinsurer()` function that regex-matches price patterns from the snapshot YAML text.
3. Wire it into the `isX` detection chain at the bottom.

### Step 5 – Test

```bash
# Run the flow
bash scripts/flow_newinsurer.sh

# Capture the snapshot
npx --yes --package @playwright/cli playwright-cli --session newinsurer snapshot > /tmp/snap.yml

# Extract and append
node scripts/append_quote_summary.mjs /tmp/snap.yml newinsurer.ie
```

---

## Debugging a Stuck Flow

When a flow hangs or throws:

```bash
# Capture current page state
npx --yes --package @playwright/cli playwright-cli --session <insurer> snapshot

# Capture console errors
npx --yes --package @playwright/cli playwright-cli --session <insurer> console
```

Inspect the latest `.playwright-cli/page-*.yml`. Check:

- Is a cookie/overlay banner blocking the click?
- Did the page postback and change the DOM? (Common in AIG ASP.NET forms.)
- Did an autocomplete dropdown appear that needs a follow-up click?
- Is a reCAPTCHA present?
- Did the URL not change after "Continue"? (Form validation error.)

---

## Key Design Decisions

**Canonical data is insurer-agnostic.** The parser produces a single `CanonicalData` object. Insurer quirks (e.g. 123.ie shows "9+" for licence years, AIG uses date bands) are handled in the mapping's `optionMap` or inside the flow script — not in the parser.

**Flow scripts are standalone.** Each `flow_<insurer>.js` embeds its own test data object and helper functions. This makes them runnable independently and easy to debug without the TypeScript layer. The fill-plan system exists for programmatic/API use; the flow scripts are the primary automation path.

**`{{value}}` selectors.** When a selector like `text={{value}}` is used, `buildFillPlan` substitutes the resolved value at runtime. This allows label-matching and text-click selectors to be data-driven.

**Stops at pricing page, never purchases.** Every flow script terminates when the quote prices are visible. No flow proceeds to checkout, payment, or binding.

**`summary.csv` is append-only.** `append_quote_summary.mjs` reads the existing file, adds the new row, and rewrites the whole file. Never delete rows; the CSV is a record of all runs.

**Warnings, not errors, for partial data.** Missing optional fields produce warnings. Only truly unparseable input should produce errors. The `unknown_lines` array captures anything the parser couldn't classify for inspection.

---

## File Map

```
src/
  cli.ts               CLI entry: --file / stdin, --insurer flag, JSON stdout
  parser.ts            parseUserText(): line dispatch to sub-parsers
  utils.ts             parseDate, parseMoneyEur, parseAddress, parseTitleAndName, extractEmail/Phone
  types.ts             CanonicalData, ParseResult, InsurerKey, FieldMapping, FillPlan, FillAction, TransformId
  mapping.ts           insurerAliases, baseFields, insurerFieldMaps
  fill-plan.ts         buildFillPlan(), applyTransform(), resolveTargetValue()
  index.ts             Public API re-exports

scripts/
  flow_123.js          123.ie Playwright automation (IIFE style)
  flow_aviva.js        Aviva Playwright automation
  flow_aig.js          AIG Direct Playwright automation (8-step ASP.NET form)
  flow_redclick.js     Redclick Playwright automation
  flow_zurich.js       Zurich Playwright automation (React-select, single-page)
  flow_*.sh            Shell wrappers to run each flow via playwright-cli
  append_quote_summary.mjs  Parse snapshot YAML → append row to summary.csv

skills/
  insurer-playwright-flow/SKILL.md        Workflow guide for building new insurer flows
  insurer-playwright-flow/references/checklist.md  Build and extraction checklists

input.txt              Example input text for the parser
summary.csv            Accumulated quote results (append-only)
tsconfig.json          ESM TypeScript config
package.json           npm scripts: parse, build
```
