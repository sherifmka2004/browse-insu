// Zurich Ireland car quote flow.
//
// Executed by playwright-cli as:
//   playwright-cli run-code "$(cat scripts/flow_zurich.js)"
//
// It must evaluate to a single async function expression.

async (page) => {
  const quoteUrl =
    "https://quote.zurich.ie/page/public/en/us/process/enter/ZurichDirectMotorProcess?productId=Motor&set=PromoCode:Protect;webid:production";

  const data = {
    vehicle: {
      reg: "09D29410",
      value: "2000",
      use: "Social, Domestic & Pleasure",
    },
    proposer: {
      title: "Mrs",
      firstName: "Hagar",
      lastName: "Nofal",
      phone: "0877181948",
      email: "sherifmka2004@hotmail.com",
      dob: "09/04/1987",
      addressSearch: "44 Churchfield Park, Ashbourne, Meath, A84A726",
      employmentStatus: "Housewife / Househusband",
      occupation: "Housewife",
    },
    driving: {
      licenceType: "Full Irish",
      licenceHeld: "2 Years",
      ncdYears: "3 Years",
      currentInsurer: "Aviva",
      policyExpiryDate: "01/06/2026",
      namedExperienceOnOtherVehicle: false,
      claimsCount: "0 Claims",
    },
    policy: {
      startDate: "20/06/2026",
    },
  };

  const wait = (ms) => page.waitForTimeout(ms);

  function exactTextRegex(text) {
    return new RegExp(`^${text.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}$`, "i");
  }

  async function acceptCookiesIfPresent() {
    const candidates = [
      page.getByRole("button", { name: /allow all cookies/i }).first(),
      page.getByRole("button", { name: /accept all cookies/i }).first(),
      page.getByRole("button", { name: /^accept$/i }).first(),
    ];

    for (const locator of candidates) {
      if (await locator.isVisible().catch(() => false)) {
        await locator.click({ force: true }).catch(() => {});
        await wait(500);
        return;
      }
    }
  }

  async function fillById(id, value) {
    const locator = page.locator(`#${id}`);
    await locator.waitFor({ state: "visible", timeout: 30000 });
    await locator.scrollIntoViewIfNeeded();
    await locator.fill(value);
    await locator.blur().catch(() => {});
    await wait(150);
  }

  async function setChecked(selector) {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "attached", timeout: 15000 });
    try {
      await locator.check({ force: true });
    } catch {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) {
          throw new Error(`Missing checkbox/radio: ${sel}`);
        }
        el.checked = true;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }, selector);
    }
  }

  async function selectReactOption({ rootSelector, inputSelector, query, optionText }) {
    const root = page.locator(rootSelector);
    await root.waitFor({ state: "visible", timeout: 30000 });
    await root.scrollIntoViewIfNeeded();
    await root.locator(".react-select__control").click({ force: true });

    const input = inputSelector
      ? page.locator(inputSelector)
      : root.locator('input[role="combobox"]').first();

    if (await input.count()) {
      await input.fill("").catch(() => {});
      if (query) {
        await input.pressSequentially(query, { delay: 40 });
      }
    }

    const option = page
      .locator('[role="option"], .react-select__option, .sk-dropdownlist-option')
      .filter({ hasText: exactTextRegex(optionText) })
      .first();

    await option.waitFor({ state: "visible", timeout: 15000 });
    await option.click({ force: true });
    await wait(250);
  }

  async function selectOccupation(optionText, query) {
    const input = page.locator("#sk-input-Motor-Customer-Occupation");
    await input.waitFor({ state: "visible", timeout: 30000 });
    await input.scrollIntoViewIfNeeded();
    await input.click({ force: true });
    await wait(300);
    await input.press("Control+A");
    await wait(100);
    await input.fill("");
    await wait(200);
    for (const char of query) {
      await input.press(char);
      await wait(150);
    }
    await wait(5000); // give autocomplete time to fetch results

    const option = page.locator("li, [role='option']").filter({ hasText: new RegExp(`^${optionText}$`) }).first();
    await option.waitFor({ state: "visible", timeout: 15000 });
    await option.click({ force: true });
    await wait(500);
  }

  async function searchAddress(addressText) {
    const box = page.getByRole("textbox", { name: "Enter Full Address or Postcode" });
    await box.waitFor({ state: "visible", timeout: 30000 });
    await box.scrollIntoViewIfNeeded();
    await box.fill(addressText);
    await page.getByRole("button", { name: "Search" }).click({ force: true });

    await page.waitForFunction(
      () => {
        const line1 = document.getElementById("Motor-ClientRiskAddress-RiskAddressAddressLine1");
        return !!line1 && !!line1.value;
      },
      { timeout: 30000 }
    );
  }

  async function clickRecaptchaIfPresent() {
    const frame = page.frameLocator('iframe[title*="reCAPTCHA"]').first();
    const checkbox = frame.getByRole("checkbox", { name: /i'?m not a robot/i });
    if (await checkbox.count().catch(() => 0)) {
      await checkbox.click({ force: true }).catch(() => {});
      await wait(1500);
    }
  }

  async function clickNext() {
    const clicked = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')
      );
      const target = nodes.find((node) => {
        const text = (node.innerText || node.value || node.getAttribute("aria-label") || "").trim();
        if (!/^next$/i.test(text)) {
          return false;
        }
        const style = window.getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden";
      });

      if (!target) {
        return false;
      }

      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    });

    if (!clicked) {
      const diagnostics = await page.evaluate(() => ({
        recaptchaChecked:
          document
            .querySelector('iframe[title*="reCAPTCHA"]')
            ?.getAttribute("title")
            ?.includes("reCAPTCHA") ?? false,
        visibleButtons: Array.from(
          document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')
        )
          .map((node) => ({
            text: (node.innerText || node.value || node.getAttribute("aria-label") || "").trim(),
            cls: node.className,
          }))
          .filter((item) => item.text),
      }));
      throw new Error(`Zurich Next button not found: ${JSON.stringify(diagnostics)}`);
    }
  }

  await page.waitForLoadState("domcontentloaded");
  if (!page.url().includes("quote.zurich.ie/page/public")) {
    await page.goto(quoteUrl, { waitUntil: "domcontentloaded" });
  }

  await acceptCookiesIfPresent();
  await fillById("Motor-Vehicle-VehicleRegistrationNumber", data.vehicle.reg);
  await fillById("Motor-Vehicle-ValueOfCar", data.vehicle.value);

  await selectReactOption({
    rootSelector: "#sk-Motor-Customer-Title",
    inputSelector: "#sk-input-sk-Motor-Customer-Title",
    query: data.proposer.title,
    optionText: data.proposer.title,
  });

  await fillById("Motor-Customer-FirstName", data.proposer.firstName);
  await fillById("Motor-Customer-LastName", data.proposer.lastName);
  await fillById("Motor-Customer-MobileNumber", data.proposer.phone);
  await fillById("Motor-Customer-EmailAddress", data.proposer.email);
  await fillById("Motor-Customer-DateOfBirth", data.proposer.dob);
  await searchAddress(data.proposer.addressSearch);
  await setChecked("#Motor-ClientRiskAddress-ParkingAddressConfirmation-1");

  await selectReactOption({
    rootSelector: "#sk-Motor-Customer-EmploymentStatus",
    inputSelector: "#sk-input-sk-Motor-Customer-EmploymentStatus",
    query: "House",
    optionText: data.proposer.employmentStatus,
  });

  await selectOccupation(data.proposer.occupation, "house");

  await selectReactOption({
    rootSelector: "#sk-Motor-MainDriver-LicenseType",
    inputSelector: "#sk-input-sk-Motor-MainDriver-LicenseType",
    query: data.driving.licenceType,
    optionText: data.driving.licenceType,
  });

  await selectReactOption({
    rootSelector: "#sk-Motor-MainDriver-YearsLicenseHeld",
    inputSelector: "#sk-input-sk-Motor-MainDriver-YearsLicenseHeld",
    query: "2",
    optionText: data.driving.licenceHeld,
  });

  await setChecked("#Motor-MainDriver-PenaltyPoints-2");
  await setChecked("#Motor-Customer-NCDPINCodeQuestion-2");

  await selectReactOption({
    rootSelector: "#sk-Motor-Customer-NoClaimsDiscount",
    inputSelector: "#sk-input-sk-Motor-Customer-NoClaimsDiscount",
    query: "3",
    optionText: data.driving.ncdYears,
  });

  await selectReactOption({
    rootSelector: "#sk-Motor-Customer-CurrentInsurer",
    inputSelector: "#sk-input-sk-Motor-Customer-CurrentInsurer",
    query: data.driving.currentInsurer.slice(0, 3),
    optionText: data.driving.currentInsurer,
  });

  await fillById("Motor-Customer-ExpiryDateOfCurrentPolicy", data.driving.policyExpiryDate);

  await setChecked(
    data.driving.namedExperienceOnOtherVehicle
      ? "#Motor-Customer-ExperienceOnAnotherVehicle-1-radio"
      : "#Motor-Customer-ExperienceOnAnotherVehicle-2-radio"
  );

  await selectReactOption({
    rootSelector: "#sk-Motor-Claims-TotalNumberOfClaims",
    inputSelector: "#sk-input-sk-Motor-Claims-TotalNumberOfClaims",
    query: "0",
    optionText: data.driving.claimsCount,
  });

  await setChecked("#Motor-TaxSaver-2");
  await setChecked("#Motor-OtherZurichPoliciesQuestion-2");

  await selectReactOption({
    rootSelector: "#sk-Motor-Vehicle-CarUse",
    inputSelector: "#sk-input-sk-Motor-Vehicle-CarUse",
    query: "Social",
    optionText: data.vehicle.use,
  });

  await fillById("Motor-PolicyStartDate", data.policy.startDate);
  await setChecked("#Motor-MarketingFlag-2");
  await setChecked("#Motor-DataProtectionAndTOB-1");

  await clickRecaptchaIfPresent();
  await page.mouse.wheel(0, 1200);
  await wait(500);
  await clickNext();

  // Wait for step 1 to transition: VRN input becomes hidden/gone
  await page.locator("#Motor-Vehicle-VehicleRegistrationNumber").waitFor({
    state: "hidden",
    timeout: 60000,
  });
  await wait(1500);

  // Accept Declarations page if shown before the quote pricing page
  const hasDeclarations = await page
    .getByRole("heading", { name: /declarations/i })
    .count()
    .catch(() => 0);
  if (hasDeclarations > 0) {
    await page.evaluate(() => {
      document.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach((cb) => {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
        cb.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    });
    await wait(500);
    await clickNext();
    await wait(2000);
  }

  // Wait for the quote pricing page (shows cover type prices)
  await page.waitForFunction(
    () => {
      const text = document.body.innerText || "";
      return /comprehensive/i.test(text) && /third.party/i.test(text) && /€\s*[\d,]+\.\d{2}/.test(text);
    },
    { timeout: 60000 }
  );
}
