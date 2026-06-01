// Aviva Ireland car insurance quote flow (accordion/single-page design).
//
// Executed by playwright-cli as:
//   playwright-cli run-code "$(cat scripts/flow_aviva.js)"

async (page) => {
  const timeout = 30000;
  const pause = (ms = 400) => page.waitForTimeout(ms);

  const data = {
    proposer: {
      title: "Mrs",
      firstName: "Hagar",
      lastName: "Nofal",
      email: "sherifmka2004@hotmail.com",
      phone: "0877181948",
      dob: "09/04/1987",
      eircode: "A84A726",
      addressLine: "44 Churchfield Park",
      town: "Ashbourne",
      county: "Meath",
    },
    driving: {
      employmentStatus: "H",   // Household Duties
      licenceType: "F",        // Full Irish
      licenceYears: "2",
      drivingExperience: "1",  // Insured in own name in Ireland/UK
      ncdYears: "3",
      commuting: "Yes",
      advancedCourse: "No",
    },
    vehicle: {
      reg: "09D29410",
      valueBand: "75000",      // Less than €75,000
      modified: "No",
    },
    policy: {
      startDate: "20/06/2026",
    },
  };

  async function setSelect(id, val) {
    await page.evaluate(([id, val]) => {
      const s = document.getElementById(id);
      if (!s) return;
      s.value = val;
      s.dispatchEvent(new Event("change", { bubbles: true }));
    }, [id, val]);
  }

  async function setInput(id, val) {
    await page.evaluate(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, [id, val]);
  }

  async function clickPostback(controlId) {
    await page.evaluate((id) => {
      const link = document.querySelector(`a[href*="${id}"]`);
      if (link) { link.click(); return; }
      const el = document.getElementById(id);
      if (el) el.click();
    }, controlId);
  }

  async function clickContinue() {
    // Always pick the one visible Continue button in the currently-open accordion section
    const btn = page.getByRole("button", { name: /continue/i }).last();
    await btn.waitFor({ state: "visible", timeout });
    await btn.click({ force: true });
    await pause(2500);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  if (!/insurance\.aviva\.ie/.test(page.url())) {
    await page.goto("https://www.aviva.ie/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /accept all cookies/i }).first().click({ force: true }).catch(() => {});
    await page.getByRole("link", { name: /get a quote for car insurance/i }).first().click();
    await page.waitForURL(/insurance\.aviva\.ie/, { timeout });
  }
  await page.getByRole("button", { name: /accept all cookies/i }).first().click({ force: true }).catch(() => {});

  // ── Section 1: About you ────────────────────────────────────────────────────
  await page.waitForURL(/quote-your-details/, { timeout });
  await page.locator("#DDLProposerTitle").selectOption({ label: data.proposer.title });
  await page.getByRole("textbox", { name: /first name/i }).first().fill(data.proposer.firstName);
  await page.getByRole("textbox", { name: /surname/i }).first().fill(data.proposer.lastName);
  await page.getByRole("textbox", { name: /email address/i }).first().fill(data.proposer.email);
  await page.getByRole("textbox", { name: /mobile number/i }).first().fill(data.proposer.phone);
  await clickContinue();

  // ── Section 2: Personal details ─────────────────────────────────────────────
  // Address eircode search
  const addrBox = page.getByRole("textbox", { name: /address or eircode/i }).first();
  await addrBox.waitFor({ state: "visible", timeout });
  await addrBox.pressSequentially(data.proposer.eircode, { delay: 80 });
  await pause(2000);
  // Click suggestion if it appears, otherwise confirm via postback
  const suggestionText = page.getByText(data.proposer.addressLine, { exact: false }).first();
  if (await suggestionText.count()) {
    await suggestionText.click({ force: true });
  }
  await pause(800);
  // Confirm address via ASP.NET postback if confirmation link is present
  const confirmLink = page.locator('a[href*="btnConfirmAddress"]').first();
  if (await confirmLink.count()) {
    await confirmLink.click({ force: true });
    await pause(2000);
  }
  // Fill remaining personal detail fields by ID
  await setInput("ProposerDOB", data.proposer.dob);
  await setSelect("EmploymentStatus", data.driving.employmentStatus);
  await setSelect("LicenceType", data.driving.licenceType);
  await pause(300);
  await setSelect("LicenceYearsHeld", data.driving.licenceYears);
  await setSelect("ddlDrivingExperience", data.driving.drivingExperience);
  await setSelect("ddlCounty", data.proposer.county);
  await clickContinue();

  // ── Section 3: Insurance details ────────────────────────────────────────────
  await setSelect("ddlYearsNCB", data.driving.ncdYears);
  await page.locator(`[name="IsCommuting"][value="${data.driving.commuting}"]`).click({ force: true }).catch(() => {});
  await page.locator('[name="IsCourses"][value="1"]').click({ force: true }).catch(() => {}); // No advanced course
  await clickContinue();

  // ── Section 4: Car details ───────────────────────────────────────────────────
  await page.locator('[name="DoYouKnowReg"][value="Yes"]').click({ force: true });
  await pause(800);
  const regInput = page.getByRole("textbox", { name: /car registration/i }).first();
  await regInput.fill(data.vehicle.reg);
  await page.getByRole("button", { name: /find car/i }).click({ force: true });
  await page.getByRole("heading", { name: new RegExp(data.vehicle.reg.toUpperCase()) }).first().waitFor({ timeout });
  // Confirm the car
  await page.locator('a[href*="btnConfirmReg"]').click({ force: true });
  await page.getByRole("heading", { name: /car successfully added/i }).first().waitFor({ timeout });
  await setSelect("VehicleCurrentValue", data.vehicle.valueBand);
  await page.locator(`[name="IsModified"][value="${data.vehicle.modified}"]`).click({ force: true });
  await clickContinue();

  // ── Section 5: Additional drivers ───────────────────────────────────────────
  await page.locator('[name="IsAdditionalDriver"][value="No"]').first().click({ force: true });
  await clickContinue();

  // ── Section 6: Claims ────────────────────────────────────────────────────────
  const claimsRadio = page.locator('[name*="IsClaims"][value="No"], [id*="IsClaims"][value="No"]').first();
  await claimsRadio.click({ force: true }).catch(() =>
    page.getByRole("radio", { name: "No" }).first().click({ force: true })
  );
  await clickContinue();

  // ── Section 7: Penalty points ────────────────────────────────────────────────
  const penaltyRadio = page.locator('[name*="IsPenalty"][value="No"], [name*="PenaltyPoints"][value="No"]').first();
  await penaltyRadio.click({ force: true }).catch(() =>
    page.getByRole("radio", { name: "No" }).first().click({ force: true })
  );
  await page.locator("#Continue7").click({ force: true });
  await pause(2500);

  // ── Section 8: Cover start date ──────────────────────────────────────────────
  const startDateInput = page.locator("#ctl00_MainContent_StartDate");
  await startDateInput.waitFor({ state: "visible", timeout });
  await startDateInput.click({ force: true });
  await startDateInput.fill("");
  await startDateInput.pressSequentially(data.policy.startDate, { delay: 60 });
  await startDateInput.press("Tab");
  await pause(600);
  // Answer the optional radio groups
  for (const [name, value] of [["IsHome", "No"], ["IsHouseholdCar", "No"], ["RecieveOffers", "No"], ["CallConsent", "Yes"]]) {
    await page.locator(`[name="${name}"][value="${value}"]`).first().click({ force: true }).catch(() => {});
    await pause(150);
  }
  // Accept terms checkbox
  await page.getByRole("checkbox", { name: /agree/i }).first().check({ force: true });
  await pause(300);
  // Submit
  await page.locator("#ctl00_MainContent_Continue8").click({ force: true });
  await page.waitForURL(/your-quote/, { timeout: 60000 });
  await page.getByRole("heading", { name: /€\d|your quote/i }).first().waitFor({ timeout: 30000 });
}
