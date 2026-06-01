import {
  CanonicalData,
  ParseResult
} from "./types.js";
import {
  extractEmail,
  extractPhone,
  normalizeLine,
  normalizeWhitespace,
  parseAddress,
  parseDate,
  parseMileageKm,
  parseMoneyEur,
  parseNumber,
  parseTitleAndName
} from "./utils.js";

export function parseUserText(input: string, parsedAt: Date = new Date()): ParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const unknown_lines: string[] = [];

  const data: CanonicalData = {
    vehicle: {},
    policy: {},
    licence: {},
    claims: {},
    driver: {},
    contact: {},
    meta: {
      source_text_language: "en-IE",
      parsed_at: parsedAt.toISOString().slice(0, 10)
    }
  };

  const lines = input
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.includes("vehicle:")) {
      parseVehicleLine(line, data, warnings);
      continue;
    }

    if (lower.includes("use:") || lower.includes("mileage:") || lower.includes("cover start")) {
      parsePolicyLine(line, data, warnings);
      continue;
    }

    if (lower.includes("licence:") || lower.includes("license:")) {
      parseLicenceLine(line, data, warnings);
      continue;
    }

    if (lower.includes("ncb:")) {
      parseNcbLine(line, data, warnings);
      continue;
    }

    if (lower.includes("driver:")) {
      parseDriverLine(line, data, warnings);
      continue;
    }

    if (lower.includes("address:")) {
      parseAddressLine(line, data, warnings);
      continue;
    }

    if (lower.includes("phone:") || lower.includes("email:")) {
      parseContactLine(line, data, warnings);
      continue;
    }

    if (lower.includes("additional driver")) {
      parseAdditionalDriversLine(line, data);
      continue;
    }

    unknown_lines.push(line);
  }

  if (!data.contact.email) {
    const email = extractEmail(input);
    if (email) data.contact.email = email;
  }

  if (!data.contact.phone) {
    const phone = extractPhone(input);
    if (phone) data.contact.phone = phone;
  }

  if (!data.contact.phone) warnings.push("Phone not specified");
  if (!data.contact.email) warnings.push("Email not specified");

  return { data, warnings, errors, unknown_lines };
}

function parseVehicleLine(line: string, data: CanonicalData, warnings: string[]) {
  const afterLabel = line.split(/vehicle:/i)[1] ?? "";
  const parts = smartSplit(afterLabel);

  const firstPart = parts[0] ?? "";
  const regMatch = firstPart.match(/reg:\s*([a-z0-9]+)/i) ?? line.match(/reg:\s*([a-z0-9]+)/i);
  if (regMatch) {
    data.vehicle.registration = regMatch[1].toUpperCase();
  }

  const yearMatch = firstPart.match(/^(\d{4})\s+(.*)$/);
  if (yearMatch) {
    data.vehicle.year = Number(yearMatch[1]);
    const makeModel = yearMatch[2];
    const makeModelParts = makeModel.split(" ");
    if (makeModelParts.length >= 2) {
      data.vehicle.make = makeModelParts[0];
      data.vehicle.model = makeModelParts.slice(1).join(" ");
    } else if (makeModelParts.length === 1) {
      data.vehicle.make = makeModelParts[0];
    }
  } else if (firstPart) {
    warnings.push(`Vehicle line missing year: ${firstPart}`);
  }

  for (const part of parts.slice(1)) {
    if (/purchased/i.test(part)) {
      const datePart = part.replace(/purchased/i, "").trim();
      const parsed = parseDate(datePart);
      if (parsed.iso) data.vehicle.purchase_date = parsed.iso;
      if (parsed.warning) warnings.push(parsed.warning);
    }

    if (/value/i.test(part)) {
      const money = parseMoneyEur(part);
      if (money !== undefined) data.vehicle.estimated_value_eur = money;
    }
  }
}

function smartSplit(input: string): string[] {
  const results: string[] = [];
  let current = "";
  let inNumber = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === ",") {
      const nextChar = input[i + 1];
      if (inNumber && nextChar && /\d/.test(nextChar)) {
        current += char;
      } else {
        results.push(normalizeWhitespace(current));
        current = "";
        inNumber = false;
      }
    } else {
      if (/\d/.test(char) && (current.match(/[€£$,\s]$/))) {
        inNumber = true;
      } else if (!/[\d\s]/.test(char) && char !== ",") {
        inNumber = false;
      }
      current += char;
    }
  }

  if (current.trim()) {
    results.push(normalizeWhitespace(current));
  }

  return results;
}

function parsePolicyLine(line: string, data: CanonicalData, warnings: string[]) {
  const segments = line.split("|").map((segment) => normalizeWhitespace(segment));
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (lower.startsWith("use:")) {
      data.policy.use = segment.split(/use:/i)[1]?.trim();
    } else if (lower.startsWith("mileage:")) {
      const mileage = parseMileageKm(segment);
      if (mileage !== undefined) data.policy.annual_mileage_km = mileage;
    } else if (lower.includes("cover start")) {
      const value = segment.split(/cover start:/i)[1]?.trim() ?? segment;
      const parsed = parseDate(value);
      if (parsed.iso) data.policy.cover_start_date = parsed.iso;
      if (parsed.warning) warnings.push(parsed.warning);
    }
  }
}

function parseLicenceLine(line: string, data: CanonicalData, warnings: string[]) {
  const afterLabel = line.split(/licen[cs]e:/i)[1] ?? "";
  const parts = afterLabel.split(",").map((part) => normalizeWhitespace(part));

  if (parts[0]) {
    data.licence.type = parts[0];
  }

  for (const part of parts.slice(1)) {
    if (/years held/i.test(part)) {
      const years = parseNumber(part);
      if (years !== undefined) data.licence.years_held = years;
    }

    if (/penalty points/i.test(part)) {
      if (/no/i.test(part)) {
        data.licence.penalty_points = 0;
      } else {
        const points = parseNumber(part);
        if (points !== undefined) data.licence.penalty_points = points;
      }
    }

    if (/convictions/i.test(part)) {
      data.licence.convictions = !/no/i.test(part);
    }
  }

  if (data.licence.convictions === undefined) {
    warnings.push("Licence convictions not specified");
  }
}

function parseNcbLine(line: string, data: CanonicalData, warnings: string[]) {
  const afterLabel = line.split(/ncb:/i)[1] ?? "";
  const parts = afterLabel.split(",").map((part) => normalizeWhitespace(part));

  if (parts[0]) {
    const years = parseNumber(parts[0]);
    if (years !== undefined) data.claims.ncb_years = years;
  }

  const claimsSegment = parts.find((part) => /claim/i.test(part));
  if (claimsSegment) {
    if (/no claims/i.test(claimsSegment)) {
      data.claims.claims_last_2_years = 0;
    } else {
      const count = parseNumber(claimsSegment);
      if (count !== undefined) data.claims.claims_last_2_years = count;
    }
  } else {
    warnings.push("Claims history not specified");
  }
}

function parseDriverLine(line: string, data: CanonicalData, warnings: string[]) {
  const afterLabel = line.split(/driver:/i)[1] ?? "";
  const parts = afterLabel.split(",").map((part) => normalizeWhitespace(part));

  if (parts[0]) {
    const name = parseTitleAndName(parts[0]);
    data.driver.title = name.title;
    data.driver.first_name = name.first_name;
    data.driver.last_name = name.last_name;
  }

  for (const part of parts.slice(1)) {
    if (/dob/i.test(part)) {
      const dobValue = part.replace(/dob/i, "").replace(/[:]/g, "").trim();
      const parsed = parseDate(dobValue);
      if (parsed.iso) data.driver.date_of_birth = parsed.iso;
      if (parsed.warning) warnings.push(parsed.warning);
    } else if (part) {
      data.driver.occupation = part;
    }
  }
}

function parseAddressLine(line: string, data: CanonicalData, warnings: string[]) {
  const afterLabel = line.split(/address:/i)[1] ?? "";
  const address = parseAddress(afterLabel);
  data.contact.address_line1 = address.address_line1;
  data.contact.town = address.town;
  data.contact.county = address.county;
  data.contact.eircode = address.eircode;

  if (!address.address_line1) warnings.push("Address line missing");
}

function parseContactLine(line: string, data: CanonicalData, warnings: string[]) {
  const segments = line.split("|").map((segment) => normalizeWhitespace(segment));
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (lower.includes("phone:")) {
      const value = segment.split(/phone:/i)[1]?.trim();
      if (value) data.contact.phone = value.replace(/[^0-9+]/g, "");
    }
    if (lower.includes("email:")) {
      const value = segment.split(/email:/i)[1]?.trim();
      if (value) data.contact.email = value;
    }
  }
}

function parseAdditionalDriversLine(line: string, data: CanonicalData) {
  if (/no additional drivers/i.test(line)) {
    data.driver.additional_drivers = false;
  } else if (/additional drivers?/i.test(line)) {
    data.driver.additional_drivers = true;
  }
}
