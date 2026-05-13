---
name: insurer-playwright-flow
description: Build and maintain reusable Playwright CLI shell flows for car-insurance quote websites. Use when a user wants to automate a new insurer site, debug stuck quote steps, add anti-bot/cookie handling, or standardize quote extraction into summary.csv.
---

# Insurer Playwright Flow

Create or update a `scripts/flow_<insurer>.sh` flow that runs end-to-end and appends quote results to `summary.csv`.

## Inputs to collect

- Insurer name and start URL
- Canonical customer JSON (or raw text to parse first)
- Required output fields for quote summary

## Required outputs

- `scripts/flow_<insurer>.sh`
- `scripts/flow_<insurer>.js` (run-code body)
- Updated `scripts/append_quote_summary.mjs` extractor for that insurer
- One successful snapshot from the final quote/pricing page
- One appended row in `summary.csv`

## Standard workflow

1. Open insurer quote URL in a dedicated session (`--session <insurer>`).
2. Accept cookie banners before first click.
3. Walk the journey with repeated `snapshot` and stable refs.
4. Build robust interactions in JS helpers (`clickSafe`, `fillTextbox`, retries, visible-first selection).
5. Handle common blockers:
- overlay intercepts
- dynamic radios/dropdowns
- masked phone/email inputs
- address lookup fallback to manual entry
- anti-bot challenge detection and fail-fast message
6. Stop only on the plans/prices page.
7. Capture final snapshot and parse prices into machine-readable values.
8. Append CSV row and print short human summary.

## Reliability rules

- Re-snapshot after each major navigation.
- Prefer role/label selectors first, then text/structural fallback.
- When multiple matching radios exist, choose visible instance.
- Guard script: if run-code output contains `### Error`, exit non-zero.
- Never append CSV if flow failed before final pricing snapshot.

## Debug protocol

When stuck on a page, capture:

```bash
npx --yes --package @playwright/cli playwright-cli --session <insurer> snapshot
npx --yes --package @playwright/cli playwright-cli --session <insurer> console
```

Then inspect the latest `.playwright-cli/page-*.yml` and fix selectors/state transitions.

For the reusable build checklist and extraction checklist, read `references/checklist.md`.
