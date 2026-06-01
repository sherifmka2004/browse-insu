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
- Uses `async (page) =>` expression
- **Bot protection**: Visits homepage first to warm up session, then navigates to quote form. Throws `Error` if PerimeterX `#px-captcha-modal` is present — user must solve the "click and hold" challenge manually before re-running.
- Selector-driven: fills inputs by `placeholder` attribute
- Date picker for cover start: navigates calendar months, clicks exact date button (e.g. `"20, June 2026"`)
- Address: Eircode autocomplete, then clicks the first matching suggestion text
- Stops at the "Get your price" pricing page

#### `flow_aviva.js`
- Uses `async (page) =>` expression
- **New design (2026)**: Aviva redesigned their quote form as a single-page accordion (ASP.NET WebForms). The old multi-step URL-based flow no longer works.
- Navigation: `https://www.aviva.ie/` → click "Get a quote for car insurance" → lands on `quote-your-details`
- 8 accordion sections filled in sequence: About you → Personal details → Insurance details → Car details → Additional drivers → Claims → Penalty points → Cover start date
- Address: Eircode autocomplete (Aviva generic search box) + ASP.NET `btnConfirmAddress` postback
- Car lookup: fills reg → "Find car" button → `btnConfirmReg` postback to confirm the 2009 Audi A4
- ASP.NET validators must pass before the final `#ctl00_MainContent_Continue8` submit button becomes active; the 4 optional radio groups (`IsHome`, `IsHouseholdCar`, `RecieveOffers`, `CallConsent`) must be clicked via Playwright (DOM manipulation alone doesn't trigger validator state)
- Stops at `your-quote` URL showing `heading "€NNN.NN" [level=1]` for the selected cover type

#### `flow_aig.js`
- Uses `async (page) =>` expression
- Navigate to `www-417.aig.ie/brands/aigdirect/motor/createnewquote.aspx` (the `enc=` parameter is a static referral code, not a session token — it doesn't expire)
- **Must run on a fresh session** — the ASP.NET accordion doesn't auto-expand sections 2–8 if a previous session's state is cached. Use a new `--session aig2` style name for each clean run.
- Handles **two** cookie banners: AIG marketing banner and TrustArc `#truste-consent-required`
- Bot detection: if "Are you a robot / CAPTCHA" text appears, throws with a message requiring manual intervention
- 8-step accordion form; each step has a numbered continue button (`#ctl00_Main_Continue1` … `#ctl00_Main_btnContinue9`)
- Address: step 2 accordion must auto-expand after Continue1; falls back to `#AddressSearch` selector if `getByRole` doesn't find it; then Eircode lookup with "Cannot find address" fallback to manual form
- Uses `page.evaluate()` to dispatch events on hidden/frozen radio inputs
- Promo code `AIG10` is pre-applied via URL parameter
- Stops at `quoteplus.aspx` (priced) or `noquote.aspx` (no online quote available for this profile)

#### `flow_redclick.js`
- Uses `async (page) =>` expression
- Navigate to `redclick.ie/car-insurance` → click "Get a quote" link → enters `carquotes.redclick.ie`
- Bot detection: throws `Error` if "Are you a robot?" appears
- Role/label selectors throughout; `visibleOrFirst()` helper for multiple matching radios
- Address: Eircode/address search with `"Can't find your address"` / `"Enter manually"` fallback
- Stops at `modular-product-selection/select-package` pricing page

#### `flow_zurich.js`
- Uses `async (page) =>` expression
- Navigate to `quote.zurich.ie` — single-page React app, no URL changes between form steps
- Missing fields vs original design (now required): `Motor-Customer-CurrentInsurer` (React-select), `Motor-Customer-ExpiryDateOfCurrentPolicy` (text), `Motor-Customer-ExperienceOnAnotherVehicle` (radio)
- Occupation: typed character-by-character with 5s autocomplete wait; uses `locator("li, [role='option']").filter({ hasText: regex })` (not `getByRole("option")` — nested listbox structure)
- reCAPTCHA: clicks `iframe[title*="reCAPTCHA"]` checkbox before submission
- Declarations page: appears between form submission and pricing; requires "Yes" radio + "Get an Initial Quote" button
- Stops when pricing page shows comprehensive and TPFT prices with `€NNN.NN` pattern

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
| `Select a plan to get started` / `carquotes.redclick.ie` / `WB[0-9]{10}` | `redclick.ie` |
| `Government Levy:` / `No Claims Bonus:` / `123.ie` | `123.ie` |
| `AIG Deluxe` / `AIG Direct` / `Quote Reference: <8+ digits>` | `aig.ie` |
| `Q-PC-\d+` / `quote.zurich.ie` / `ZurichDirect` | `zurich.ie` |
| `insurance.aviva.ie` / `Your Quote Reference.*aviva` | `aviva.ie` |

> The old Redclick signature `Quote reference:` was removed because it falsely matched the Aviva snapshot (which also contains "Your Quote Reference:").

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

| InsurerKey | Aliases | Flow script | Mapping selectors | Extraction | Notes |
|---|---|---|---|---|---|
| `123` | `123` | ✅ `flow_123.js` | ✅ full selectors | ✅ `extract123()` | PerimeterX CAPTCHA blocks fresh sessions; warm up browser manually once |
| `aviva` | `aviva` | ✅ `flow_aviva.js` | ⬜ labels only | ✅ `extractAviva()` | Redesigned 2026; single-page ASP.NET accordion; 2 snapshots needed for TPFT price |
| `redclick` | `redclick` | ✅ `flow_redclick.js` | ⬜ labels only | ✅ `extractRedclick()` | |
| `zurich` | `zurich`, `zurick` | ✅ `flow_zurich.js` | ⬜ labels only | ✅ `extractZurich()` | Requires 3 extra fields: current insurer, policy expiry, named driving experience |
| `aa` | `aa` | ⬜ not started | ⬜ labels only | ⬜ not implemented | |
| `chill` | `chill`, `chill insurance` | ⬜ not started | ⬜ labels only | ⬜ not implemented | |
| `supervalu` | `supervalu` | ⬜ not started | ⬜ labels only | ⬜ not implemented | |
| `anpost` | `anpost`, `an post` | ⬜ not started | ⬜ labels only | ⬜ not implemented | |
| `allianz` | `allianz` | ⬜ not started | ⬜ labels only | ⬜ not implemented | |

> AIG (`aig`) is implemented in `flow_aig.js` and `extractAig()` but does **not** have an `InsurerKey` entry in `types.ts` or a mapping entry — it is driven entirely by the flow script. AIG returns `noquote.aspx` for some profiles (e.g. newer drivers with < 2 years licence); this is handled as `status: no_quote_online`.

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
