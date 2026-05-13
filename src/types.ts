export interface CanonicalData {
  vehicle: {
    year?: number;
    make?: string;
    model?: string;
    registration?: string;
    purchase_date?: string; // YYYY-MM-DD
    estimated_value_eur?: number;
  };
  policy: {
    use?: string;
    annual_mileage_km?: number;
    cover_start_date?: string; // YYYY-MM-DD
  };
  licence: {
    type?: string;
    years_held?: number;
    penalty_points?: number;
    convictions?: boolean;
  };
  claims: {
    ncb_years?: number;
    claims_last_2_years?: number;
  };
  driver: {
    title?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string; // YYYY-MM-DD
    occupation?: string;
    additional_drivers?: boolean;
  };
  contact: {
    address_line1?: string;
    town?: string;
    county?: string;
    eircode?: string;
    phone?: string;
    email?: string;
  };
  meta: {
    source_text_language?: string;
    parsed_at?: string; // YYYY-MM-DD
  };
}

export interface ParseResult {
  data: CanonicalData;
  warnings: string[];
  errors: string[];
  unknown_lines: string[];
}

export type InsurerKey =
  | "123"
  | "redclick"
  | "zurich"
  | "aviva"
  | "aa"
  | "chill"
  | "supervalu"
  | "anpost"
  | "allianz";

export type CanonicalFieldPath =
  | "vehicle.year"
  | "vehicle.make"
  | "vehicle.model"
  | "vehicle.registration"
  | "vehicle.purchase_date"
  | "vehicle.estimated_value_eur"
  | "policy.use"
  | "policy.annual_mileage_km"
  | "policy.cover_start_date"
  | "licence.type"
  | "licence.years_held"
  | "licence.penalty_points"
  | "licence.convictions"
  | "claims.ncb_years"
  | "claims.claims_last_2_years"
  | "driver.title"
  | "driver.first_name"
  | "driver.last_name"
  | "driver.date_of_birth"
  | "driver.occupation"
  | "driver.additional_drivers"
  | "contact.address_line1"
  | "contact.town"
  | "contact.county"
  | "contact.eircode"
  | "contact.phone"
  | "contact.email";

export type InputType = "text" | "select" | "radio" | "checkbox" | "click";

export type ValueKey = "day" | "month" | "year";

export type TransformId =
  | "date_dmy"
  | "date_dmy_slashes"
  | "date_month_year"
  | "date_label_long"
  | "bool_yes_no"
  | "bool_true_false"
  | "upper"
  | "lower"
  | "euros"
  | "km"
  | "number"
  | "trim";

export interface FillTarget {
  selector?: string; // CSS or other locator (supports {{value}} placeholder)
  label?: string; // Human-readable label to resolve later
  inputType: InputType;
  valueKey?: ValueKey; // For split date fields
  optionMap?: Record<string, string>; // Map canonical value to form option value
  note?: string;
}

export interface FieldMapping {
  valueFrom: CanonicalFieldPath;
  required?: boolean;
  transform?: TransformId;
  targets: FillTarget[];
  note?: string;
}

export interface FillAction {
  insurer: InsurerKey;
  fieldPath: CanonicalFieldPath;
  selector: string;
  inputType: InputType;
  value: string;
  note?: string;
}

export interface FillPlan {
  actions: FillAction[];
  warnings: string[];
}
