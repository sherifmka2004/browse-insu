async (page) => {
  const timeout = 30000;

  const pause = (ms = 300) => page.waitForTimeout(ms);

  async function clickSafe(locator, clickTimeout = timeout) {
    const target = locator.first();
    await target.waitFor({ state: "visible", timeout: clickTimeout });
    try {
      await target.click({ timeout: clickTimeout });
    } catch {
      await target.click({ timeout: clickTimeout, force: true });
    }
  }

  async function clickButton(name) {
    await clickSafe(page.getByRole("button", { name }));
  }

  async function clickLink(name) {
    await clickSafe(page.getByRole("link", { name }));
  }

  async function clickContinue() {
    await clickSafe(page.getByRole("button", { name: /continue/i }).last());
  }

  async function fillTextbox(name, value) {
    const input = page.getByRole("textbox", { name }).first();
    await input.waitFor({ state: "visible", timeout });
    await input.fill(String(value));
  }

  async function typeLikeUser(name, value) {
    const input = page.getByRole("textbox", { name }).first();
    await input.waitFor({ state: "visible", timeout });
    await input.click({ force: true });
    await input.press("Meta+A").catch(async () => {
      await input.press("Control+A");
    });
    await input.type(String(value), { delay: 35 });
    await input.blur();
  }

  async function chooseRadio(question, answer) {
    const section = page.getByRole("heading", { name: question }).first().locator("xpath=..");
    const sectionRadio = section.getByRole("radio", { name: answer }).first();
    if (await sectionRadio.count()) {
      try {
        await sectionRadio.check({ force: true });
        return;
      } catch {}
      try {
        await sectionRadio.click({ force: true });
        return;
      } catch {}
    }

    const globalRadio = page.getByRole("radio", { name: answer }).first();
    if (await globalRadio.count()) {
      try {
        await globalRadio.check({ force: true });
        return;
      } catch {}
      try {
        await globalRadio.click({ force: true });
        return;
      } catch {}
    }

    try {
      await clickSafe(section.getByText(answer).first());
    } catch {
      await clickSafe(page.getByText(answer).first());
    }
  }

  async function clickSectionButton(question, buttonName) {
    await page.getByRole("heading", { name: question }).first().waitFor({ timeout });
    await clickSafe(page.getByRole("button", { name: buttonName }).first());
  }

  async function visibleOrFirst(locator) {
    const count = await locator.count();
    for (let i = 0; i < count; i += 1) {
      const candidate = locator.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
    return locator.first();
  }

  async function pickOccupation() {
    const occ = page.getByRole("textbox", { name: /type an occupation/i }).first();
    await occ.waitFor({ state: "visible", timeout });
    await occ.click({ force: true });
    await occ.fill("");
    await occ.type("house", { delay: 50 });
    await pause(700);

    const housewife = page.getByText(/^Housewife$/).first();
    if (await housewife.count()) {
      await clickSafe(housewife);
      return;
    }

    const housekeeper = page.getByText(/^Housekeeper$/).first();
    if (await housekeeper.count()) {
      await clickSafe(housekeeper);
      return;
    }

    const firstOption = page.locator("li, [role='option']").first();
    if (await firstOption.count()) {
      await clickSafe(firstOption);
    }
  }

  if (!/insurance\.aviva\.ie.*CreateNewQuote/.test(page.url())) {
    await page.goto("https://insurance.aviva.ie/products/Car/CreateNewQuote.aspx?enc=NUic3N57azQgnbRz7sSkmB2yiwSz8k1TVn8SwmhjvnqqGezVsAHUF97jCZCPKJva", { waitUntil: "domcontentloaded" });
  }

  await clickButton(/accept all cookies/i).catch(() => {});

  if (/Get Started|Start your quote/i.test(page.textContent() || "")) {
    await clickButton(/get started|start your quote/i);
  }

  await page.waitForURL(/quote-your-details|quote-details/, { timeout });
  await fillTextbox(/first name/i, "Hagar");
  await fillTextbox(/last name/i, "Nofal");
  await fillTextbox(/date of birth/i, "09/04/1987");
  await typeLikeUser(/phone number/i, "0877181948");
  await fillTextbox(/^email address$/i, "sherifmka2004@hotmail.com");
  await fillTextbox(/confirm email address/i, "sherifmka2004@hotmail.com");
  await pickOccupation();
  await clickContinue();

  await page.waitForURL(/quote-your-car/, { timeout });
  await fillTextbox(/car registration number/i, "09D29410");
  await clickButton(/find my car/i);

  await page.getByRole("heading", { name: /is this your car\?/i }).first().waitFor({ timeout });
  await chooseRadio(/standard right hand drive/i, /yes/i);
  await clickButton(/continue/i);

  await page.waitForURL(/quote-your-driving-history/, { timeout });

  const fullIrishRadio = await visibleOrFirst(page.getByRole("radio", { name: /full irish/i }));
  await fullIrishRadio.waitFor({ state: "attached", timeout });
  await fullIrishRadio.check({ force: true });
  await pause(250);
  if (!(await page.getByLabel(/driving licence years/i).count())) {
    await clickSafe(fullIrishRadio.locator("xpath=.."));
  }
  await page.getByLabel(/driving licence years/i).selectOption("2 years");
  await page
    .getByRole("heading", { name: /type of insurance have you had most recently/i })
    .first()
    .waitFor({ timeout });

  const ownNameRadio = await visibleOrFirst(
    page.getByRole("radio", { name: /insured in my own name/i })
  );
  await ownNameRadio.waitFor({ state: "attached", timeout });
  await ownNameRadio.check({ force: true });
  await pause(250);
  if (!(await page.getByLabel(/years with no claims discount/i).count())) {
    await clickSafe(ownNameRadio.locator("xpath=.."));
  }

  await page.getByLabel(/years with no claims discount/i).selectOption("3 years");
  await chooseRadio(/penalty points or convictions/i, /no/i);
  await pause(300);
  await chooseRadio(/accident or claim/i, /no/i);
  await pause(300);

  await chooseRadio(/additional drivers/i, /no/i);
  await pause(400);

  await fillTextbox(/start date/i, "20/04/2026");
  await clickContinue();

  await page.waitForURL(/quote-your-address/, { timeout });

  const hasManualAddressFields = await page.getByRole("textbox", { name: /address line 1/i }).count();
  if (!hasManualAddressFields) {
    const cantFindAddress = page.getByText(/can't find your address/i).first();
    if (await cantFindAddress.count()) {
      await clickSafe(cantFindAddress.locator("xpath=.."));
    }
    const enterManually = page.getByText(/enter manually/i).first();
    if (await enterManually.count()) {
      await clickSafe(enterManually);
    }
  }

  await fillTextbox(/address line 1/i, "44 Churchfield Park");
  await fillTextbox(/town or city/i, "Ashbourne");
  await page.getByRole("combobox", { name: /county/i }).first().selectOption("County Meath");
  await fillTextbox(/eircode/i, "A84A726");

  const postalCheckbox = page.getByRole("checkbox", { name: /also my postal address/i }).first();
  if (await postalCheckbox.count()) {
    if (!(await postalCheckbox.isChecked())) {
      await postalCheckbox.check({ force: true });
    }
  }

  await clickContinue();

  await page.waitForURL(/quote-your-cover/, { timeout });

  const comprehensiveRadio = await visibleOrFirst(
    page.getByRole("radio", { name: /comprehensive/i })
  );
  await comprehensiveRadio.waitFor({ state: "attached", timeout });
  await comprehensiveRadio.check({ force: true });
  await clickContinue();

  await page.waitForURL(/quote-your-terms/, { timeout });
  const termsCheckbox = page.getByRole("checkbox", { name: /accepted the terms/i }).first();
  if (await termsCheckbox.count()) {
    if (!(await termsCheckbox.isChecked())) {
      await termsCheckbox.check({ force: true });
    }
  }

  await clickButton(/get my price/i);
  await page.waitForURL(/quote-summary|view-your-quote|review-your-quote/, { timeout: 60000 });
  await page.getByRole("heading", { name: /your quote|your price|review your quote/i }).first().waitFor({ timeout: 60000 });
}