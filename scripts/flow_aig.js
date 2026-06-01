// AIG Direct (Ireland) car quote flow.
//
// NOTE: This file is executed by playwright-cli as a function:
//   playwright-cli run-code "$(cat scripts/flow_aig.js)"
//
// It must therefore export a single expression of the form:
//   async (page) => { ... }

async (page) => {
  const data = {
    proposer: {
      title: "Mrs",
      firstName: "Hagar",
      lastName: "Nofal",
      email: "sherifmka2004@hotmail.com",
      phone: "0877181948",
      dob: { day: "9", month: "April", year: "1987" },
      sex: "Female",
      employmentStatus: "Household Duties",
      permanentResidentBand: "9-10 years", // user said 10 years
      licenceType: "Full Irish",
      licenceHeld: "2 Years",
      passedTestInIreland: "Yes",
      yearsDrivingInIrelandBand: "4+ years", // user said 7 years
      address: {
        line1: "44 Churchfield Park",
        line2: "",
        town: "Ashbourne",
        county: "Co. Meath",
        eircode: "A84A726",
      },
    },
    policy: {
      startDate: { day: "20", month: "Jun", year: "2026" },
      promoCode: "AIG10",
    },
    insuranceHistory: {
      recentExperience: "Policy in my own name",
      ncbYears: "3 years",
      consecutiveClaimsFreeNamed: "2",
      ncbCountry: "Ireland",
    },
    vehicle: {
      reg: "09D29410",
      hasValidNct: "Yes",
      mainDriver: "Yes",
      registeredOwner: "Yes",
      purchaseDate: { day: "1", month: "Dec", year: "2017" },
      valueBand: "€1,001 - €2,000",
      annualKmBand: "4501 - 6000",
      modified: "No",
    },
  };

  const createQuoteUrl =
    "https://www-417.aig.ie/brands/aigdirect/motor/createnewquote.aspx" +
    "?enc=NUic3N57azQgnbRz7sSkmARMmeT5Dn0dTb7Vxycz0TCWiWNObn12%20JASL5rlzG5mkY10Ip3JD983o94%20XFOFQ/pNkAw7kLLLoOsyVZ8o3i4IZy/Z8WfK%20p1wRmPIznqu" +
    "&PromoCode=AIG10";

  async function maybeFailOnBotChallenge() {
    const botText = page.getByText(/are you a robot|captcha|verify you are human/i);
    if (await botText.count()) {
      throw new Error("Bot challenge detected (Are you a robot / CAPTCHA). Manual step required.");
    }
  }

  async function acceptCookiesIfPresent() {
    // AIG marketing cookie banner (top of page) with explicit buttons.
    const acceptAllCookies = page.getByRole("button", { name: /Accept All Cookies/i }).first();
    if (await acceptAllCookies.isVisible().catch(() => false)) {
      await acceptAllCookies.click({ force: true }).catch(() => {});
      await acceptAllCookies.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      return;
    }

    // TrustArc banner (common on AIG quote pages) can intercept clicks.
    const trustArcBtn = page.locator("#truste-consent-required").first();
    if (await trustArcBtn.isVisible().catch(() => false)) {
      await trustArcBtn.click({ force: true }).catch(() => {});
      await page
        .locator("#consent_blackbar, #trustarc-banner-overlay, .tc-overlay")
        .first()
        .waitFor({ state: "hidden", timeout: 5000 })
        .catch(() => {});
      return;
    }

    // Generic fallbacks (best-effort).
    const acceptBtn = page.getByRole("button", { name: /accept/i }).first();
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  async function clickContinue() {
    // AIG uses multiple "Continue" links/buttons; usually the last visible one is the right one.
    await acceptCookiesIfPresent();
    const link = page.getByRole("link", { name: "Continue" }).filter({ hasText: "Continue" });
    if (await link.count()) {
      await link.last().click();
      return;
    }
    const text = page.getByText("Continue", { exact: true });
    await text.last().click();
  }

  async function clickById(selector) {
    await acceptCookiesIfPresent();
    const target = page.locator(selector).first();
    await target.waitFor({ state: "attached", timeout: 15000 });
    if (await target.isVisible().catch(() => false)) {
      await target.click({ force: true });
      return;
    }

    // AIG sometimes leaves the correct anchor hidden inside a collapsed accordion.
    // These controls are simple postback links, so a DOM click is enough.
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) {
        throw new Error(`Element not found for selector: ${sel}`);
      }
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }, selector);
  }

  async function checkHiddenRadio(selector) {
    await page.locator(selector).first().waitFor({ state: "attached", timeout: 15000 });
    await page.evaluate((sel) => {
      const input = document.querySelector(sel);
      if (!input) {
        throw new Error(`Radio not found for selector: ${sel}`);
      }
      input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }, selector);
  }

  function sectionByHeading(re) {
    return page.getByRole("heading", { name: re }).first().locator("..");
  }

  async function fillTextboxNearLabel(label, value) {
    const container = page.getByText(label, { exact: true }).locator("..");
    await container.getByRole("textbox").first().fill(value);
  }

  async function selectComboboxNearLabel(labelRe, optionLabel) {
    const container = page.getByText(labelRe).first().locator("..");
    await container.locator("select").first().selectOption({ label: optionLabel });
  }

  async function selectDob(day, month, year) {
    const dobBlock = page.getByText("Date of Birth", { exact: true }).locator("..");
    const selects = dobBlock.locator("select");
    await selects.nth(0).selectOption({ label: day });
    await selects.nth(1).selectOption({ label: month });
    await selects.nth(2).selectOption({ label: year });
  }

  async function selectPurchaseDate(day, month, year) {
    const block = page.getByText("Vehicle purchase date", { exact: true }).locator("..");
    const selects = block.locator("select");
    await selects.nth(0).selectOption({ label: day });
    await selects.nth(1).selectOption({ label: month });
    await selects.nth(2).selectOption({ label: year });
  }

  async function setPolicyStartDate(day, month, year) {
    const block = page.getByText("Policy Start Date", { exact: true }).locator("..");
    const selects = block.locator("select");
    await selects.nth(0).selectOption({ label: day });
    await selects.nth(1).selectOption({ label: month });
    await selects.nth(2).selectOption({ label: year });
  }

  // Flow runner opens the create-quote URL. If we're not on the quote journey, navigate.
  await page.waitForLoadState("domcontentloaded");
  const currentUrl = page.url();
  const onQuoteJourney =
    currentUrl.includes("/brands/aigdirect/motor/yourdetails.aspx") ||
    currentUrl.includes("/brands/aigdirect/motor/quoteplus.aspx");
  if (!onQuoteJourney) {
    await page.goto(createQuoteUrl, { waitUntil: "domcontentloaded" });
  }
  await acceptCookiesIfPresent();
  await maybeFailOnBotChallenge();

  // Step 1: Your Details
  // Title label exists more than once (proposer + driver), so use position-based selectors on step 1.
  await page.getByRole("combobox").first().selectOption({ label: data.proposer.title });
  const step1Textboxes = page.getByRole("textbox");
  await step1Textboxes.nth(0).fill(data.proposer.firstName);
  await step1Textboxes.nth(1).fill(data.proposer.lastName);
  await step1Textboxes.nth(2).fill(data.proposer.email);
  await step1Textboxes.nth(3).fill(data.proposer.phone);
  const continue1 = page.locator("#ctl00_Main_Continue1");
  if (await continue1.count()) {
    await continue1.click({ force: true });
  } else {
    await clickContinue();
  }
  await maybeFailOnBotChallenge();

  // Step 2: Your Information
  // On a fresh session the accordion auto-expands; on a stale session click the heading to expand.
  const step2Heading = page.getByRole("heading", { name: /2\.\s*Your Information/i }).first();
  if (await step2Heading.count()) {
    await step2Heading.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  // The address search input: try getByRole first (works on fresh sessions), then fall back to #AddressSearch.
  let eircodeBox = page.getByRole("textbox", { name: /Start typing address or Eircode/i }).first();
  if (!(await eircodeBox.isVisible().catch(() => false))) {
    eircodeBox = page.locator("#AddressSearch, #AddressSearchManual").first();
  }
  await eircodeBox.waitFor({ state: "visible", timeout: 30000 });
  // Address/Eircode: attempt lookup, but we fall back to manual entry when needed.
  await eircodeBox.fill(data.proposer.address.eircode);
  await page.waitForTimeout(600);
  // Try clicking the first suggestion if it appears.
  const suggestion = page.getByRole("listbox").locator("li").first();
  if (await suggestion.count()) {
    await suggestion.click();
  } else {
    const cannotFind = page.getByRole("link", { name: /Cannot find address/i }).first();
    if (await cannotFind.count()) {
      await cannotFind.click();
    }
  }

  // Manual address path (AIG sometimes can't resolve Eircode lookup).
  if (await page.getByText("Address 1", { exact: true }).count()) {
    // Manual address form groups the "Please enter your address below:" text separately from the inputs.
    // Go up 2 levels to capture the full manual form region.
    const manualBlock = page
      .getByText(/Please enter your address below/i)
      .first()
      .locator("..")
      .locator("..");
    await fillTextboxNearLabel("Address 1", data.proposer.address.line1);
    // AIG validates Address 2 on this manual branch; use the town/locality.
    await fillTextboxNearLabel("Address 2", data.proposer.address.line2 || data.proposer.address.town);
    const manualCounty = manualBlock
      .getByRole("combobox")
      .filter({ has: manualBlock.getByRole("option", { name: /Please Select County/i }) })
      .first();
    if (await manualCounty.count()) {
      await manualCounty.selectOption({ label: data.proposer.address.county });
    } else {
      // Fallback: find any county-like dropdown by its default option.
      await page
        .getByRole("combobox")
        .filter({ has: page.getByRole("option", { name: /Please Select County/i }) })
        .first()
        .selectOption({ label: data.proposer.address.county });
    }
    const subArea = page.getByRole("combobox", { name: /Sub Area of County/i }).first();
    if (await subArea.count()) {
      await subArea.selectOption({ label: data.proposer.address.town });
    }
    await fillTextboxNearLabel("Postcode", data.proposer.address.eircode);
    await page.getByRole("link", { name: /Confirm Address/i }).first().click({ force: true });
    // The manual address block should disappear after a successful confirmation.
    await page
      .getByText(/Please enter your address below/i)
      .first()
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  }

  const confirmResolvedAddress = page.getByRole("link", { name: /Yes Confirm/i }).first();
  if (await confirmResolvedAddress.count()) {
    await confirmResolvedAddress.click({ force: true });
    await page.waitForTimeout(500);
  }

  await selectComboboxNearLabel(/permanent resident/i, data.proposer.permanentResidentBand);
  await selectDob(data.proposer.dob.day, data.proposer.dob.month, data.proposer.dob.year);
  // "Female" appears for proposer + driver; prefer proposer list when present.
  const proposerSexList = page.locator("#ProposerSexList");
  if (await proposerSexList.count()) {
    await proposerSexList.getByText(data.proposer.sex, { exact: true }).click();
  } else {
    await page.getByText("Sex", { exact: true }).locator("..").getByText(data.proposer.sex, { exact: true }).click();
  }
  await selectComboboxNearLabel("Employment status", data.proposer.employmentStatus);
  // "Full Irish" appears for proposer + driver licence; prefer proposer control when present.
  const proposerLicenceType = page.locator("#ctl00_Main_LicenceType");
  if (await proposerLicenceType.count()) {
    await proposerLicenceType.getByText(data.proposer.licenceType, { exact: true }).click();
  } else {
    await page
      .getByText("What type of driving licence do you hold?", { exact: false })
      .first()
      .locator("..")
      .getByText(data.proposer.licenceType, { exact: true })
      .click();
  }
  await page.getByText("Did you pass your test in Ireland").locator("..").getByText(data.proposer.passedTestInIreland, { exact: true }).click();
  await selectComboboxNearLabel("When did you obtain this driving licence?", data.proposer.licenceHeld);
  await page.getByText("Years driving In Ireland", { exact: true }).locator("..").getByText(data.proposer.yearsDrivingInIrelandBand, { exact: true }).click();
  await clickById("#ctl00_Main_Continue2");
  await maybeFailOnBotChallenge();

  // Step 3: Insurance Details
  // Accordion panels can collapse after postbacks; ensure Step 3 is expanded.
  await page.getByRole("heading", { name: /3\\. Insurance Details/i }).first().click().catch(() => {});
  await page
    .getByText("Your most recent driving experience", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Your most recent driving experience", { exact: true }).locator("..").locator("select").selectOption({ label: data.insuranceHistory.recentExperience });
  await page.getByText("How many years no claims bonus", { exact: false })
    .locator("..")
    .getByText(data.insuranceHistory.ncbYears, { exact: true })
    .click();
  await page.getByText("How many consecutive claims free years", { exact: false })
    .locator("..")
    .locator("select")
    .first()
    .selectOption({ label: data.insuranceHistory.consecutiveClaimsFreeNamed });
  await page.getByText("In which country was your no claims bonus earned?", { exact: true })
    .locator("..")
    .getByText(data.insuranceHistory.ncbCountry, { exact: true })
    .click();
  await clickById("#ctl00_Main_Continue3");
  await maybeFailOnBotChallenge();

  // Step 4: Vehicle Details
  await page.getByText("Vehicle registration", { exact: true }).locator("..").getByRole("textbox").first().fill(data.vehicle.reg);
  await page.getByRole("link", { name: /Find Car/i }).first().click();
  await page.getByRole("heading", { name: /Vehicle Search Results/i }).first().waitFor({ timeout: 30000 });
  await page.getByText("Does your car have a valid NCT?", { exact: true }).locator("..").getByText(data.vehicle.hasValidNct, { exact: true }).click();
  await page.getByText("Will you be the main driver of this car?", { exact: true }).locator("..").getByText(data.vehicle.mainDriver, { exact: true }).click();
  await page.getByText("Are you the registered owner of this car?", { exact: true }).locator("..").getByText(data.vehicle.registeredOwner, { exact: true }).click();
  await selectPurchaseDate(data.vehicle.purchaseDate.day, data.vehicle.purchaseDate.month, data.vehicle.purchaseDate.year);
  await selectComboboxNearLabel(/current estimated car value/i, data.vehicle.valueBand);
  await page.getByText("How many kilometres will this car travel over the next 12 months?", { exact: true })
    .locator("..")
    .locator("select")
    .first()
    .selectOption({ label: data.vehicle.annualKmBand });
  await page.getByText("Has this car been modified or adapted in any way?", { exact: true }).locator("..").getByText(data.vehicle.modified, { exact: true }).click();
  await page.getByRole("link", { name: /Save Vehicle/i }).first().click();

  // Step 4 continue
  await page.waitForTimeout(800);
  await clickById("#ctl00_Main_Continue4");
  await maybeFailOnBotChallenge();

  // Step 5: Additional Drivers (none)
  await page.waitForTimeout(500);
  await clickById("#ctl00_Main_Continue6");
  await maybeFailOnBotChallenge();

  // Step 6: Claims (No)
  await page
    .locator("#ctl00_Main_DriverHistoryRepeater_ctl00_rblIsClaim > li:nth-child(2) > label")
    .click({ force: true });
  await clickById("#ctl00_Main_btnContinue5");

  // Step 7: Penalty Points (No)
  await checkHiddenRadio("#ctl00_Main_PPDriverRepeater_ctl00_rblIsPenaltyPoints_1");
  await clickById("#ctl00_Main_btnContinue9");

  // Step 8: Eligibility + policy start + terms
  await setPolicyStartDate(data.policy.startDate.day, data.policy.startDate.month, data.policy.startDate.year);

  // Ensure promo code is set (some runs prefill it).
  const promo = page.getByRole("textbox", { name: /Promo Code/i }).first();
  if (await promo.count()) {
    await promo.fill(data.policy.promoCode);
  }

  await page.getByRole("checkbox", { name: /READ and ACCEPT/i }).check();
  await page.getByRole("button", { name: /Get Your Quote/i }).click();
  await page.waitForURL(/\/(quoteplus|noquote)\.aspx/i, { timeout: 60000 });
  await maybeFailOnBotChallenge();
}
