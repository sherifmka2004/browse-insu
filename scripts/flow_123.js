(async () => {
  const waitFor = (sel) => page.waitForSelector(sel, { timeout: 20000 });
  const clickText = (text) => page.getByText(text, { exact: true }).click();
  const clickContains = (text) => page.getByText(text).first().click();
  const clickNext = () => page.getByRole('button', { name: /^Next$/ }).first().click();
  const pause = (ms = 500) => page.waitForTimeout(ms);

  const accept = page.getByRole('button', { name: /accept|allow all/i });
  if (await accept.count()) await accept.first().click();

  await waitFor('input[placeholder*="231D000"]');
  await page.fill('input[placeholder*="231D000"]', '09D29410');
  await page.getByRole('button', { name: /Find my car/i }).click();
  await clickNext();

  await waitFor('input[placeholder="Select a date"]');
  const purchase = page.locator('input[placeholder="Select a date"]').first();
  await purchase.fill('December 2017');
  await page.fill('input[aria-label*="car is worth"]', '2000');
  await clickNext();

  await clickText('Social, domestic & pleasure');
  await clickNext();

  await waitFor('input[placeholder="Select to the nearest thousand"]');
  await page.fill('input[placeholder="Select to the nearest thousand"]', '5000');
  await page.keyboard.press('Enter');
  await clickNext();

  await waitFor('input[placeholder="Select a date"]');
  await page.locator('input[placeholder="Select a date"]').click();
  for (let i = 0; i < 12; i += 1) {
    if (await page.getByText(/APRIL 2026/i).count()) break;
    await page.getByRole('button', { name: /Next month/i }).click();
    await pause(200);
  }
  await page.getByRole('button', { name: '20, April 2026' }).click();
  await clickNext();

  await clickContains('Driving history');

  await clickText('Full Irish Licence');
  await clickText('2');
  await clickNext();

  await clickText('No');
  await clickNext();

  await clickText('No');
  await clickNext();

  await clickText('Not applicable');
  await clickNext();

  await clickText('Yes');
  await clickText('3');
  await clickNext();

  await clickText('No');
  await clickNext();

  await clickContains('Next: About you');

  await clickText('No, none of the above apply');
  await clickNext();

  await page.locator('input[placeholder="Please select..."]').click();
  await clickText('Mrs');
  await page.fill('input[placeholder="E.g. Orla"]', 'Hagar');
  await page.fill('input[placeholder="E.g. McCarthy"]', 'Nofal');
  await page.fill('input[placeholder="DD/MM/YYYY"]', '09/04/1987');
  await clickNext();

  await clickText('Homemaker');
  await clickNext();

  await page.fill('input[placeholder="Start typing an Eircode or address"]', 'A84A726');
  await clickText('44 CHURCHFIELD PARK, ASHBOURNE, MEATH, A84A726');
  await clickNext();

  await page.fill('input[placeholder="E.g. 086 123 4567"]', '0877181948');
  await page.fill('input[placeholder="E.g. orla@123.ie"]', 'sherifmka2004@hotmail.com');
  await clickNext();

  await clickText('No');
  await clickNext();

  const checks = page.locator('input[type=checkbox], [role=checkbox]');
  if (await checks.count()) {
    try {
      await checks.first().check();
    } catch {
      await checks.first().click();
    }
  } else {
    await page.getByText('I accept the Disclosure Requirements').click().catch(() => {});
  }
  await page.getByRole('button', { name: /Next: Get your price/i }).click();
})();
