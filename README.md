# browse-insu

Parse semi-structured insurance input text into a canonical JSON payload, then derive per-insurer fill plans for Playwright.

## What you get
- Canonical JSON with normalized fields
- A per-insurer mapping layer (labels only for now)
- A fill-plan generator that turns JSON into Playwright-ready actions

## Install
```bash
npm install
```

## Usage
Parse from stdin:
```bash
cat input.txt | npm run parse
```

Parse and build a fill plan for a specific insurer:
```bash
cat input.txt | npm run parse -- --insurer aviva
```

Or read from file:
```bash
npm run parse -- --file ./input.txt --insurer "chill insurance"
```

## Important: selectors are placeholders
The per-insurer mapping in `src/mapping.ts` contains **labels only**, no real selectors yet. You need to add site-specific selectors (or label locators) for each insurer.

Recommended next step:
1. Inspect each insurer form with Playwright.
2. Replace `label` entries in the mapping with real `selector` values.
3. Run `buildFillPlan` to generate fill actions.

## Notes
- Dates are parsed in `DD/MM/YYYY` format (Ireland default).
- Month/year inputs like `Dec 2017` default to day `01` and add a warning.
