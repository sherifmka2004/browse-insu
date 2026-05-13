import {
  CanonicalData,
  CanonicalFieldPath,
  FillAction,
  FillPlan,
  FieldMapping,
  InsurerKey,
  TransformId
} from "./types.js";
import { getValueByPath } from "./utils.js";
import { insurerFieldMaps } from "./mapping.js";

interface SplitDate {
  day: string;
  month: string;
  year: string;
}

type TransformOutput = string | number | boolean | SplitDate;

export function buildFillPlan(data: CanonicalData, insurer: InsurerKey): FillPlan {
  const mappings = insurerFieldMaps[insurer];
  const actions: FillAction[] = [];
  const warnings: string[] = [];

  for (const mapping of mappings) {
    const rawValue = getValueByPath(data, mapping.valueFrom) as TransformOutput | undefined;

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      if (mapping.required) {
        warnings.push(`Missing required value for ${mapping.valueFrom}`);
      }
      continue;
    }

    const transformed = applyTransform(rawValue, mapping.transform, mapping.valueFrom, warnings);

    for (const target of mapping.targets) {
      if (!target.selector) {
        warnings.push(`Missing selector for ${mapping.valueFrom} (${target.label ?? "unknown label"})`);
        continue;
      }

      let value = resolveTargetValue(transformed, target.valueKey);
      if (value === undefined) {
        warnings.push(`Unable to resolve value for ${mapping.valueFrom} (${target.label ?? "unknown label"})`);
        continue;
      }

      if (target.optionMap && value in target.optionMap) {
        value = target.optionMap[value];
      }

      let selector = target.selector;
      if (selector && selector.includes("{{value}}")) {
        selector = selector.replace(/{{value}}/g, value);
      }

      actions.push({
        insurer,
        fieldPath: mapping.valueFrom,
        selector: selector ?? target.selector ?? "",
        inputType: target.inputType,
        value,
        note: target.note
      });
    }
  }

  return { actions, warnings };
}

function applyTransform(
  value: TransformOutput,
  transform: TransformId | undefined,
  field: CanonicalFieldPath,
  warnings: string[]
): TransformOutput {
  if (!transform) return value;

  switch (transform) {
    case "date_dmy": {
      if (typeof value !== "string") {
        warnings.push(`Expected ISO date string for ${field}`);
        return value;
      }
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) {
        warnings.push(`Invalid ISO date for ${field}: ${value}`);
        return value;
      }
      return { day: match[3], month: match[2], year: match[1] };
    }
    case "date_dmy_slashes": {
      if (typeof value !== "string") return value;
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return value;
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    case "date_month_year": {
      if (typeof value !== "string") return value;
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return value;
      const monthIndex = Number(match[2]) - 1;
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ];
      const monthName = monthNames[monthIndex] ?? match[2];
      return `${monthName} ${match[1]}`;
    }
    case "date_label_long": {
      if (typeof value !== "string") return value;
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return value;
      const day = String(Number(match[3]));
      const monthIndex = Number(match[2]) - 1;
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ];
      const monthName = monthNames[monthIndex] ?? match[2];
      return `${day}, ${monthName} ${match[1]}`;
    }
    case "bool_yes_no": {
      if (typeof value === "boolean") return value ? "Yes" : "No";
      return String(value);
    }
    case "bool_true_false": {
      if (typeof value === "boolean") return value ? "true" : "false";
      return String(value);
    }
    case "upper": {
      return String(value).toUpperCase();
    }
    case "lower": {
      return String(value).toLowerCase();
    }
    case "euros": {
      return typeof value === "number" ? String(Math.round(value)) : String(value);
    }
    case "km": {
      return typeof value === "number" ? String(Math.round(value)) : String(value);
    }
    case "number": {
      return typeof value === "number" ? String(value) : String(value).replace(/[^0-9]/g, "");
    }
    case "trim": {
      return String(value).trim();
    }
    default:
      return value;
  }
}

function resolveTargetValue(value: TransformOutput, key?: "day" | "month" | "year"): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object") {
    if (!key) return undefined;
    const split = value as SplitDate;
    return split[key];
  }
  return String(value);
}
