#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error(
    "Usage: node scripts/append_quote_summary.mjs <snapshot.yml> [insurer] [csv_path]"
  );
  process.exit(1);
}

const snapshotArg = process.argv[2];
const insurerInput = process.argv[3] ?? "123.ie";
const csvPath = process.argv[4] ?? "summary.csv";
const policyStartDateFallback = process.env.POLICY_START_DATE ?? "";

if (!snapshotArg) {
  usage();
}

const snapshotPaths = snapshotArg
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

for (const p of snapshotPaths) {
  if (!fs.existsSync(p)) {
    console.error(`Snapshot file not found: ${p}`);
    process.exit(1);
  }
}

const raws = snapshotPaths.map((p) => fs.readFileSync(p, "utf8"));
const raw = raws[0] ?? "";

function toNumber(val) {
  if (!val) return "";
  return Number(val.replace(/,/g, ""));
}

function pick(re) {
  const m = raw.match(re);
  return m ? m[1] : "";
}

function normalizeInsurer(insurer) {
  const normalized = insurer.trim().toLowerCase();
  if (normalized === "auto" || normalized === "detect") {
    if (/Select a plan to get started|Quote reference:/i.test(raw)) {
      return "redclick.ie";
    }
    if (/Car Insurance Quotes \| 123\.ie|Government Levy:|No Claims Bonus:/i.test(raw)) {
      return "123.ie";
    }
    if (/AIG Deluxe|AIG Direct|Quote Reference:\s*[0-9]{8,}/i.test(raw)) {
      return "aig.ie";
    }
    if (/Q-PC-\d+|quote\.zurich\.ie|ZurichDirect/i.test(raw)) {
      return "zurich.ie";
    }
    if (/insurance\.aviva\.ie|Your Quote Reference.*aviva|Aviva car insurance/i.test(raw)) {
      return "aviva.ie";
    }
  }
  return normalized;
}

function extractAviva() {
  const quoteRef = pick(/Your Quote Reference:\s*([0-9]+)/i) || pick(/(35[0-9]{9,})/);
  const policyStart = pick(/valid until\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) || "";
  // Prices appear as heading "€NNN.NN" — comprehensive is typically shown first
  const allPrices = [];
  const priceRe = /heading "€\s*([\d,]+\.\d{2})"/gi;
  let m;
  while ((m = priceRe.exec(raw)) !== null) {
    allPrices.push(toNumber(m[1]));
  }
  // If multiple snapshots: first snapshot = comprehensive selected, second = TPFT selected.
  // The level=1 heading is the selected plan's pay-in-full price.
  const compRaw = raws[0] ?? "";
  const tpftRaw = raws[1] ?? compRaw;
  // level=1 heading = the currently-selected plan's pay-in-full price
  const compAnnual = toNumber((compRaw.match(/heading "€\s*([\d,]+\.\d{2})" \[level=1\]/i) || [])[1] || "") ||
    allPrices[0] || toNumber(pick(/Comprehensive[\s\S]{0,200}?€\s*([\d,]+\.\d{2})/i));
  // TPFT price only available when a second snapshot (with TPFT selected) is passed
  const tpftAnnual = raws.length > 1
    ? toNumber((tpftRaw.match(/heading "€\s*([\d,]+\.\d{2})" \[level=1\]/i) || [])[1] || "")
    : "";
  return {
    quoteStatus: compAnnual ? "priced" : "unknown",
    notes: "",
    quoteReference: quoteRef,
    policyStartDate: policyStart,
    comprehensiveAnnual: compAnnual,
    tpftAnnual: tpftAnnual || "",
    tpoAnnual: "",
    payInFullSavings: "",
    ncbDiscountAmount: "",
    onlineDiscountAmount: "",
    governmentLevy: "",
    minutesLeft: "",
    quoteValidToday: "",
  };
}

function extract123() {
  return {
    quoteStatus: "priced",
    notes: "",
    quoteReference: "",
    policyStartDate: "",
    comprehensiveAnnual: toNumber(
      pick(/Comprehensive cover:[\s\S]{0,240}text:\s*€([0-9,]+\.[0-9]{2})\s*\/\s*year/i)
    ),
    tpftAnnual: toNumber(
      pick(/Third-party,\s*Fire\s*&\s*Theft cover:[\s\S]{0,240}text:\s*€([0-9,]+\.[0-9]{2})\s*\/\s*year/i)
    ),
    tpoAnnual: "",
    payInFullSavings: toNumber(
      pick(/By choosing to pay in full you save €([0-9,]+\.[0-9]{2})/i)
    ),
    ncbDiscountAmount: toNumber(
      pick(/No Claims Bonus:[\s\S]*?-€([0-9,]+\.[0-9]{2})/i)
    ),
    onlineDiscountAmount: toNumber(
      pick(/Online Discount:[\s\S]*?-€([0-9,]+\.[0-9]{2})/i)
    ),
    governmentLevy: toNumber(
      pick(/Government Levy:[\s\S]*?€([0-9,]+\.[0-9]{2})/i)
    ),
    minutesLeft: pick(/You have ([0-9]+) minutes left in this session/i),
    quoteValidToday: /valid for today only/i.test(raw) ? "yes" : "no",
  };
}

function extractRedclick() {
  return {
    quoteStatus: "priced",
    notes: "",
    quoteReference: pick(/Quote reference:\s*([A-Z0-9]+)/i),
    policyStartDate: pick(/Policy start date:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i),
    comprehensiveAnnual: toNumber(
      pick(/Comprehensive[\s\S]{0,200}?€([0-9,]+\.[0-9]{2})\s*\/\s*Pay in full/i)
    ),
    tpftAnnual: toNumber(
      pick(/Third Party Fire and Theft[\s\S]{0,200}?€([0-9,]+\.[0-9]{2})\s*\/\s*Pay in full/i)
    ),
    tpoAnnual: toNumber(
      pick(/Third Party Only[\s\S]{0,200}?€([0-9,]+\.[0-9]{2})\s*\/\s*Pay in full/i)
    ),
    payInFullSavings: "",
    ncbDiscountAmount: "",
    onlineDiscountAmount: "",
    governmentLevy: "",
    minutesLeft: "",
    quoteValidToday: "",
  };
}

function extractAig() {
  const noQuoteRaw = raws.find((text) =>
    /Quotation Result|unable to provide an online quotation/i.test(text)
  );

  if (noQuoteRaw) {
    return {
      quoteStatus: "no_quote_online",
      notes: "Unable to provide an online quotation; contact AIG via livechat",
      quoteReference:
        noQuoteRaw.match(/Your Quote Reference is:\s*"?([0-9]+)"?/i)?.[1] ??
        noQuoteRaw.match(/strong\s+\[.*?\]:\s*"([0-9]+)"/i)?.[1] ??
        "",
      policyStartDate: "",
      comprehensiveAnnual: "",
      tpftAnnual: "",
      tpoAnnual: "",
      payInFullSavings: "",
      ncbDiscountAmount: "",
      onlineDiscountAmount: "",
      governmentLevy: "",
      minutesLeft: "",
      quoteValidToday: "",
    };
  }

  // AIG quote page shows one premium at a time (cover dropdown). We support passing
  // 2 snapshots: first with Comprehensive selected, second with TPFT selected.
  const compRaw = raws[0] ?? "";
  const tpftRaw = raws[1] ?? "";

  const quoteReference =
    pick(/Quote Reference:\s*([0-9]+)/i) ||
    (compRaw.match(/Quote Reference:\s*([0-9]+)/i)?.[1] ?? "") ||
    (tpftRaw.match(/Quote Reference:\s*([0-9]+)/i)?.[1] ?? "");

  const comprehensiveAnnual = toNumber(
    (compRaw.match(/heading\s+"€\s*([0-9,]+\.[0-9]{2})"\s*\[level=2\]/i)?.[1] ?? "") ||
      (compRaw.match(/heading\s+"€\s*([0-9,]+\.[0-9]{2})"/i)?.[1] ?? "")
  );

  const tpftAnnual = toNumber(
    (tpftRaw.match(/heading\s+"€\s*([0-9,]+\.[0-9]{2})"\s*\[level=2\]/i)?.[1] ?? "") ||
      (tpftRaw.match(/heading\s+"€\s*([0-9,]+\.[0-9]{2})"/i)?.[1] ?? "")
  );

  return {
    quoteStatus: "priced",
    notes: "",
    quoteReference,
    policyStartDate: "",
    comprehensiveAnnual,
    tpftAnnual,
    tpoAnnual: "",
    payInFullSavings: "",
    ncbDiscountAmount: "",
    onlineDiscountAmount: "",
    governmentLevy: "",
    minutesLeft: "",
    quoteValidToday: "",
  };
}

function extractZurich() {
  const quoteRef =
    pick(/Quote number\s+(Q-PC-\d+)/i) ||
    pick(/(Q-PC-\d+)/i) ||
    "";

  // Prices appear near cover type labels on the quote page.
  // Try "Comprehensive ... €NNN.NN" or "€NNN.NN ... Comprehensive" patterns.
  const compAnnual = toNumber(
    pick(/Comprehensive(?:\s+(?:Cover|Plus))?[\s\S]{0,400}?€\s*([\d,]+\.\d{2})/i) ||
    pick(/€\s*([\d,]+\.\d{2})[\s\S]{0,200}?comprehensive/i)
  );
  const tpftAnnual = toNumber(
    pick(/Third[\s-]Party[\s,]+Fire\s*(?:and|&)\s*Theft[\s\S]{0,400}?€\s*([\d,]+\.\d{2})/i) ||
    pick(/€\s*([\d,]+\.\d{2})[\s\S]{0,200}?third[\s-]party[\s,]+fire/i)
  );
  const tpoAnnual = toNumber(
    pick(/Third[\s-]Party\s+Only[\s\S]{0,400}?€\s*([\d,]+\.\d{2})/i) ||
    pick(/€\s*([\d,]+\.\d{2})[\s\S]{0,200}?third[\s-]party\s+only/i)
  );

  const policyStart = pick(/policy start date:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) || "";

  return {
    quoteStatus: compAnnual || tpftAnnual ? "priced" : "unknown",
    notes: "",
    quoteReference: quoteRef,
    policyStartDate: policyStart,
    comprehensiveAnnual: compAnnual,
    tpftAnnual,
    tpoAnnual,
    payInFullSavings: "",
    ncbDiscountAmount: "",
    onlineDiscountAmount: "",
    governmentLevy: "",
    minutesLeft: "",
    quoteValidToday: "",
  };
}

const insurer = normalizeInsurer(insurerInput);
const isRedclick =
  /redclick/.test(insurer) || /Select a plan to get started|carquotes\.redclick\.ie|WB[0-9]{10}/i.test(raw);
const isAig = /aig(\.ie)?/.test(insurer) || /AIG Deluxe|AIG Direct/i.test(raw);
const isZurich = /zurich/.test(insurer) || /Q-PC-\d+.*quote\.zurich|ZurichDirect/i.test(raw);
const isAviva = /aviva/.test(insurer) || /insurance\.aviva\.ie|Your Quote Reference.*aviva/i.test(raw);
const extracted = isZurich
  ? extractZurich()
  : isAig
  ? extractAig()
  : isRedclick
  ? extractRedclick()
  : isAviva
  ? extractAviva()
  : extract123();

const snapshotBase = snapshotPaths.map((p) => path.basename(p)).join(",");
const extractedAt = new Date().toISOString();

const headers = [
  "extracted_at",
  "insurer",
  "snapshot_file",
  "quote_status",
  "notes",
  "quote_reference",
  "policy_start_date",
  "comprehensive_annual_eur",
  "third_party_fire_theft_annual_eur",
  "third_party_only_annual_eur",
  "pay_in_full_savings_eur",
  "ncb_discount_eur",
  "online_discount_eur",
  "government_levy_eur",
  "quote_valid_today",
  "session_minutes_left",
];

const rowObj = {
  extracted_at: extractedAt,
  insurer,
  snapshot_file: snapshotBase,
  quote_status: extracted.quoteStatus ?? "",
  notes: extracted.notes ?? "",
  quote_reference: extracted.quoteReference,
  policy_start_date: extracted.policyStartDate || policyStartDateFallback,
  comprehensive_annual_eur: extracted.comprehensiveAnnual,
  third_party_fire_theft_annual_eur: extracted.tpftAnnual,
  third_party_only_annual_eur: extracted.tpoAnnual,
  pay_in_full_savings_eur: extracted.payInFullSavings,
  ncb_discount_eur: extracted.ncbDiscountAmount,
  online_discount_eur: extracted.onlineDiscountAmount,
  government_levy_eur: extracted.governmentLevy,
  quote_valid_today: extracted.quoteValidToday,
  session_minutes_left: extracted.minutesLeft,
};

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let i = 0;
  let inQuotes = false;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      out.push(current);
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  out.push(current);
  return out;
}

function formatCsv(headersList, rows) {
  const headerLine = headersList.map(csvEscape).join(",");
  const lines = rows.map((row) =>
    headersList.map((header) => csvEscape(row[header] ?? "")).join(",")
  );
  return `${headerLine}\n${lines.join("\n")}\n`;
}

function readExistingRows(filePath) {
  const existing = fs.readFileSync(filePath, "utf8");
  const lines = existing
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const existingHeaders = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const obj = {};
    for (let i = 0; i < existingHeaders.length; i += 1) {
      obj[existingHeaders[i]] = cols[i] ?? "";
    }
    return obj;
  });

  return rows;
}

const rows = [];
if (fs.existsSync(csvPath)) {
  rows.push(...readExistingRows(csvPath));
}
rows.push(rowObj);

fs.writeFileSync(csvPath, formatCsv(headers, rows), "utf8");

const summaryLines = isZurich
  ? [
      `${insurer} quote summary`,
      `Status: ${extracted.quoteStatus || "n/a"}`,
      `Quote reference: ${extracted.quoteReference || "n/a"}`,
      `Policy start date: ${(extracted.policyStartDate || policyStartDateFallback) || "n/a"}`,
      `Comprehensive: €${extracted.comprehensiveAnnual || "n/a"} / year`,
      `Third Party Fire and Theft (TPFT): €${extracted.tpftAnnual || "n/a"} / year`,
      `Third Party Only: €${extracted.tpoAnnual || "n/a"} / year`,
      `Appended to: ${csvPath}`,
    ]
  : isAig
  ? [
      `${insurer} quote summary`,
      `Status: ${extracted.quoteStatus || "n/a"}`,
      `Quote reference: ${extracted.quoteReference || "n/a"}`,
      `Notes: ${extracted.notes || "n/a"}`,
      `Policy start date: ${(extracted.policyStartDate || policyStartDateFallback) || "n/a"}`,
      `Comprehensive: €${extracted.comprehensiveAnnual || "n/a"} / year`,
      `Third Party Fire and Theft (TPFT): €${extracted.tpftAnnual || "n/a"} / year`,
      `Appended to: ${csvPath}`,
    ]
  : isRedclick
  ? [
      `${insurer} quote summary`,
      `Status: ${extracted.quoteStatus || "n/a"}`,
      `Quote reference: ${extracted.quoteReference || "n/a"}`,
      `Policy start date: ${extracted.policyStartDate || "n/a"}`,
      `Comprehensive: €${extracted.comprehensiveAnnual || "n/a"} / Pay in full`,
      `Third Party Fire and Theft: €${extracted.tpftAnnual || "n/a"} / Pay in full`,
      `Third Party Only: €${extracted.tpoAnnual || "n/a"} / Pay in full`,
      `Appended to: ${csvPath}`,
    ]
  : isAviva
  ? [
      `${insurer} quote summary`,
      `Status: ${extracted.quoteStatus || "n/a"}`,
      `Quote reference: ${extracted.quoteReference || "n/a"}`,
      `Policy start date: ${(extracted.policyStartDate || policyStartDateFallback) || "n/a"}`,
      `Comprehensive: €${extracted.comprehensiveAnnual || "n/a"} / year (pass 2 snapshots for TPFT)`,
      `Third Party Fire and Theft: €${extracted.tpftAnnual || "n/a"} / year`,
      `Appended to: ${csvPath}`,
    ]
  : [
      `${insurer} quote summary`,
      `Status: ${extracted.quoteStatus || "n/a"}`,
      `Comprehensive: €${extracted.comprehensiveAnnual || "n/a"} / year`,
      `Third-party, Fire & Theft: €${extracted.tpftAnnual || "n/a"} / year`,
      `Pay-in-full savings: €${extracted.payInFullSavings || "n/a"}`,
      `NCB discount: €${extracted.ncbDiscountAmount || "n/a"}`,
      `Online discount: €${extracted.onlineDiscountAmount || "n/a"}`,
      `Government levy: €${extracted.governmentLevy || "n/a"}`,
      `Valid today: ${extracted.quoteValidToday || "n/a"}`,
      `Session minutes left: ${extracted.minutesLeft || "n/a"}`,
      `Appended to: ${csvPath}`,
    ];

console.log(summaryLines.join("\n"));
