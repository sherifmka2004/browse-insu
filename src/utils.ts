import { CanonicalData } from "./types.js";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

const TITLE_SET = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "mx"]);

export function stripEmojis(input: string): string {
  return input.replace(/\p{Extended_Pictographic}/gu, "");
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function normalizeLine(input: string): string {
  const noEmoji = stripEmojis(input);
  return normalizeWhitespace(noEmoji.replace(/^[^A-Za-z0-9]+/, ""));
}

export function parseDate(value: string): { iso?: string; warning?: string } {
  const raw = value.trim();
  if (!raw) return {};

  let match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return { iso: toIsoDate(year, month, day) };
  }

  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    return { iso: toIsoDate(year, month, day) };
  }

  match = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (match) {
    const monthName = match[1].toLowerCase();
    const year = Number(match[2]);
    const month = MONTHS[monthName];
    if (month) {
      return { iso: toIsoDate(year, month, 1), warning: "Day missing for month/year; defaulted to 1" };
    }
  }

  return { warning: `Unrecognized date: ${raw}` };
}

export function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseMoneyEur(value: string): number | undefined {
  const cleaned = value.replace(/[^0-9.,]/g, "");
  if (!cleaned) return undefined;
  const normalized = cleaned.replace(/,/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

export function parseNumber(value: string): number | undefined {
  const cleaned = value.replace(/[^0-9]/g, "");
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

export function parseMileageKm(value: string): number | undefined {
  return parseNumber(value);
}

export function extractEmail(text: string): string | undefined {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : undefined;
}

export function extractPhone(text: string): string | undefined {
  const match = text.match(/\+?\d[\d\s-]{6,}/);
  if (!match) return undefined;
  return match[0].replace(/[^0-9+]/g, "");
}

export function parseTitleAndName(full: string): { title?: string; first_name?: string; last_name?: string } {
  const parts = normalizeWhitespace(full).split(" ");
  if (parts.length === 0) return {};

  const first = parts[0].toLowerCase();
  let title: string | undefined;
  let nameParts = parts;

  if (TITLE_SET.has(first)) {
    title = capitalize(parts[0]);
    nameParts = parts.slice(1);
  }

  if (nameParts.length === 0) {
    return { title };
  }

  const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined;
  const first_name = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0];

  return { title, first_name, last_name };
}

export function parseAddress(raw: string): {
  address_line1?: string;
  town?: string;
  county?: string;
  eircode?: string;
} {
  const parts = raw.split(",").map((part) => normalizeWhitespace(part));
  if (parts.length === 0) return {};

  const lastPart = parts[parts.length - 1];
  const eircode = extractEircode(lastPart);
  let eircodePartUsed = false;

  if (eircode) {
    eircodePartUsed = true;
  }

  const address_line1 = parts[0] || undefined;
  const town = parts.length > 1 ? parts[1] : undefined;
  const county = parts.length > 2 ? parts[2] : undefined;

  return {
    address_line1,
    town,
    county,
    eircode: eircode || (eircodePartUsed ? undefined : extractEircode(raw))
  };
}

export function extractEircode(text: string): string | undefined {
  const match = text.match(/[A-Z]\d{2}\s?[A-Z0-9]{4}/i);
  if (!match) return undefined;
  return match[0].replace(/\s+/g, "").toUpperCase();
}

export function getValueByPath(data: CanonicalData, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

export function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
