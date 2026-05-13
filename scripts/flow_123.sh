#!/usr/bin/env bash
set -euo pipefail

PW="npx --yes --package @playwright/cli playwright-cli --session 123"

# Open at reg search (headed). It may redirect to select-product.
$PW open "https://www.123.ie/insurance/car/#/search-reg" --headed

# Accept cookies if present, then wait for dialog to disappear
$PW run-code "await page.getByRole('button',{name:/accept all/i}).first().waitFor({state:'visible', timeout:10000}).catch(()=>{})"
$PW run-code "await page.getByRole('button',{name:/accept all/i}).first().click().catch(()=>page.getByText('ACCEPT ALL',{exact:true}).first().click().catch(()=>{}))"
$PW run-code "await page.getByRole('dialog',{name:/cookies|we use cookies/i}).first().waitFor({state:'hidden', timeout:10000}).catch(()=>{})"

# Select "Car Insurance" product (redirect often lands on select-product)
$PW run-code "await page.getByText('Car Insurance', { exact: true }).click({ timeout: 10000 })"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Vehicle lookup
$PW run-code "await page.waitForSelector('input[placeholder*=\\\"231D000\\\"]',{timeout:20000}).catch(()=>{})"
$PW run-code "await page.fill('input[placeholder*=\\\"231D000\\\"]','09D29410')"
$PW run-code "await page.getByRole('button',{name:/Find my car/i}).click()"
$PW run-code "await page.getByText('Found').first().waitFor({timeout:20000}).catch(()=>{})"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Purchase date + value
$PW run-code "await page.waitForSelector('#vehiclePurchaseDate',{timeout:20000})"
$PW run-code "await page.evaluate(()=>{const el=document.getElementById('vehiclePurchaseDate'); if (el) { el.removeAttribute('readonly'); el.value=''; }})"
$PW run-code "await page.fill('#vehiclePurchaseDate','December 2017')"
$PW run-code "await page.evaluate(()=>{const el=document.getElementById('vehiclePurchaseDate'); if (el) { el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }})"
$PW run-code "await page.getByRole('textbox',{name:/how much your car is worth/i}).fill('2000')"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Use of vehicle
$PW run-code "await page.getByText('Social, domestic & pleasure',{exact:true}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Mileage (dropdown)
$PW run-code "await page.getByRole('textbox',{name:/nearest thousand/i}).click()"
$PW run-code "await page.getByText('5,000km',{exact:true}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Cover start date
$PW run-code "await page.locator('input[placeholder=\\\"Select a date\\\"]').click()"
$PW run-code "await page.getByRole('button',{name:'20, April 2026'}).click().catch(()=>{})"
$PW run-code "await page.getByRole('button',{name:/Next month/i}).click().catch(()=>{})"
$PW run-code "await page.getByRole('button',{name:'20, April 2026'}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Transition to driving history (best-effort)
$PW run-code "await page.getByText('Driving history').first().click().catch(()=>{})"

$PW run-code "await page.getByText('Full Irish Licence',{exact:true}).click()"
$PW run-code "await page.click('#btn-licenceYearsHeld-2')"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Penalty points
$PW run-code "await page.getByText('No',{exact:true}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Convictions
$PW run-code "await page.getByText('No',{exact:true}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Medical condition
$PW run-code "await page.getByText('Not applicable',{exact:true}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

$PW run-code "await page.getByRole('heading',{name:/policy in your name/i}).first().waitFor({timeout:10000})"
$PW run-code "await page.getByRole('heading',{name:/policy in your name/i}).first().locator('..').getByText('Yes',{exact:true}).click()"
$PW run-code "await page.locator('#btn-experienceYears-2').click().catch(()=>page.getByRole('heading',{name:/no claims bonus/i}).first().locator('..').getByText('2',{exact:true}).click())"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"
$PW run-code "await page.getByRole('heading',{name:/claims in the last 4 years/i}).first().waitFor({timeout:10000})"

# Claims last 4 years
$PW run-code "await page.getByRole('heading',{name:/claims in the last 4 years/i}).first().locator('..').getByText('No',{exact:true}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

$PW run-code "await page.getByText('Please select if you have named driving experience',{exact:true}).first().locator('..').getByText('No',{exact:true}).click().catch(()=>{})"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Transition to About you (best-effort)
$PW run-code "await page.getByText('Next: About you').first().click().catch(()=>{})"

# Loyalty question
$PW run-code "await page.getByText('No, none of the above apply').click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Tell us about you
$PW run-code "await page.locator('input[placeholder=\\\"Please select...\\\"]').click()"
$PW run-code "await page.getByText('Mrs',{exact:true}).click()"
$PW run-code "await page.fill('input[placeholder=\\\"E.g. Orla\\\"]','Hagar')"
$PW run-code "await page.fill('input[placeholder=\\\"E.g. McCarthy\\\"]','Nofal')"
$PW run-code "await page.fill('input[placeholder=\\\"DD/MM/YYYY\\\"]','09/04/1987')"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Employment status
$PW run-code "await page.getByText('Homemaker',{exact:true}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Address lookup
$PW run-code "await page.fill('input[placeholder=\\\"Start typing an Eircode or address\\\"]','A84A726')"
$PW run-code "await page.getByText('CHURCHFIELD PARK').first().click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Phone + email
$PW run-code "await page.fill('input[placeholder=\\\"E.g. 086 123 4567\\\"]','0877181948')"
$PW run-code "await page.fill('input[placeholder=\\\"E.g. orla@123.ie\\\"]','sherifmka2004@hotmail.com')"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Additional driver
$PW run-code "await page.getByText('No',{exact:true}).click()"
$PW run-code "await page.getByRole('button',{name:/next/i}).first().click()"

# Offer page: try accept disclosure then proceed
$PW run-code "await page.locator('input[type=checkbox], [role=checkbox]').first().click().catch(()=>{})"
$PW run-code "await page.getByText('I accept the Disclosure Requirements').click().catch(()=>{})"
$PW run-code "await page.getByRole('button',{name:/Next: Get your price/i}).first().click()"

# Capture final quote page and append machine-readable summary CSV
$PW snapshot
LATEST_SNAPSHOT="$(ls -1t .playwright-cli/page-*.yml | head -n 1)"
node scripts/append_quote_summary.mjs "$LATEST_SNAPSHOT" "123.ie" "summary.csv"
