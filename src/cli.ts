import fs from "node:fs";
import { parseUserText } from "./parser.js";
import { buildFillPlan } from "./fill-plan.js";
import { insurerAliases, insurerKeys } from "./mapping.js";
import { InsurerKey } from "./types.js";

const args = process.argv.slice(2);

function getArgValue(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

const filePath = getArgValue("--file");
const insurerInput = getArgValue("--insurer");

let rawInput = "";
if (filePath) {
  rawInput = fs.readFileSync(filePath, "utf8");
} else {
  rawInput = fs.readFileSync(0, "utf8");
}

if (!rawInput.trim()) {
  console.error("No input provided. Use --file or pipe text into stdin.");
  process.exit(1);
}

const result = parseUserText(rawInput);

let insurer: InsurerKey | undefined;
if (insurerInput) {
  const normalized = insurerInput.trim().toLowerCase();
  insurer = insurerAliases[normalized];
  if (!insurer) {
    console.error(`Unknown insurer: ${insurerInput}`);
    console.error(`Known insurers: ${insurerKeys.join(", ")}`);
    process.exit(1);
  }
}

if (insurer) {
  const fillPlan = buildFillPlan(result.data, insurer);
  console.log(JSON.stringify({ ...result, fillPlan }, null, 2));
} else {
  console.log(JSON.stringify(result, null, 2));
}
