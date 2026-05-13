import { FieldMapping, InsurerKey } from "./types.js";

export const insurerAliases: Record<string, InsurerKey> = {
  "123": "123",
  redclick: "redclick",
  zurick: "zurich",
  zurich: "zurich",
  aviva: "aviva",
  aa: "aa",
  chill: "chill",
  "chill insurance": "chill",
  supervalu: "supervalu",
  anpost: "anpost",
  "an post": "anpost",
  allianz: "allianz"
};

const baseFields: FieldMapping[] = [
  {
    valueFrom: "vehicle.registration",
    required: true,
    targets: [
      {
        label: "Vehicle Registration",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "vehicle.year",
    required: true,
    targets: [
      {
        label: "Vehicle Year",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "vehicle.make",
    required: true,
    targets: [
      {
        label: "Vehicle Make",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "vehicle.model",
    required: true,
    targets: [
      {
        label: "Vehicle Model",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "vehicle.purchase_date",
    required: false,
    transform: "date_dmy",
    targets: [
      {
        label: "Purchase Day",
        inputType: "select",
        valueKey: "day"
      },
      {
        label: "Purchase Month",
        inputType: "select",
        valueKey: "month"
      },
      {
        label: "Purchase Year",
        inputType: "select",
        valueKey: "year"
      }
    ]
  },
  {
    valueFrom: "vehicle.estimated_value_eur",
    required: false,
    transform: "euros",
    targets: [
      {
        label: "Vehicle Value",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "policy.use",
    required: true,
    targets: [
      {
        label: "Use of Vehicle",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "policy.annual_mileage_km",
    required: true,
    transform: "km",
    targets: [
      {
        label: "Annual Mileage (km)",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "policy.cover_start_date",
    required: true,
    transform: "date_dmy",
    targets: [
      {
        label: "Cover Start Day",
        inputType: "select",
        valueKey: "day"
      },
      {
        label: "Cover Start Month",
        inputType: "select",
        valueKey: "month"
      },
      {
        label: "Cover Start Year",
        inputType: "select",
        valueKey: "year"
      }
    ]
  },
  {
    valueFrom: "licence.type",
    required: true,
    targets: [
      {
        label: "Licence Type",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "licence.years_held",
    required: true,
    transform: "number",
    targets: [
      {
        label: "Years Licence Held",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "licence.penalty_points",
    required: true,
    transform: "number",
    targets: [
      {
        label: "Penalty Points",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "licence.convictions",
    required: true,
    transform: "bool_yes_no",
    targets: [
      {
        label: "Licence Convictions",
        inputType: "radio"
      }
    ]
  },
  {
    valueFrom: "claims.ncb_years",
    required: true,
    transform: "number",
    targets: [
      {
        label: "No Claims Bonus Years",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "claims.claims_last_2_years",
    required: true,
    transform: "number",
    targets: [
      {
        label: "Claims In Last 2 Years",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "driver.title",
    required: true,
    targets: [
      {
        label: "Driver Title",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "driver.first_name",
    required: true,
    targets: [
      {
        label: "Driver First Name",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "driver.last_name",
    required: true,
    targets: [
      {
        label: "Driver Last Name",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "driver.date_of_birth",
    required: true,
    transform: "date_dmy",
    targets: [
      {
        label: "Driver DOB Day",
        inputType: "select",
        valueKey: "day"
      },
      {
        label: "Driver DOB Month",
        inputType: "select",
        valueKey: "month"
      },
      {
        label: "Driver DOB Year",
        inputType: "select",
        valueKey: "year"
      }
    ]
  },
  {
    valueFrom: "driver.occupation",
    required: true,
    targets: [
      {
        label: "Driver Occupation",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "driver.additional_drivers",
    required: true,
    transform: "bool_yes_no",
    targets: [
      {
        label: "Additional Drivers",
        inputType: "radio"
      }
    ]
  },
  {
    valueFrom: "contact.address_line1",
    required: true,
    targets: [
      {
        label: "Address Line 1",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "contact.town",
    required: true,
    targets: [
      {
        label: "Town",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "contact.county",
    required: true,
    targets: [
      {
        label: "County",
        inputType: "select"
      }
    ]
  },
  {
    valueFrom: "contact.eircode",
    required: true,
    targets: [
      {
        label: "Eircode",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "contact.phone",
    required: true,
    targets: [
      {
        label: "Phone",
        inputType: "text"
      }
    ]
  },
  {
    valueFrom: "contact.email",
    required: true,
    targets: [
      {
        label: "Email",
        inputType: "text"
      }
    ]
  }
];

export const insurerFieldMaps: Record<InsurerKey, FieldMapping[]> = {
  "123": baseFields.map((field) => {
    if (field.valueFrom === "vehicle.registration") {
      return {
        ...field,
        targets: field.targets.map((target) => ({
          ...target,
          selector: "input[placeholder=\"E.g. 231D000\"]",
          note: "Verify selector on 123.ie quote form (Vehicle details step)."
        }))
      };
    }
    if (field.valueFrom === "vehicle.purchase_date") {
      return {
        ...field,
        transform: "date_month_year",
        targets: [
          {
            label: "Purchase Date",
            inputType: "text",
            selector: "input[placeholder=\"Select a date\"]",
            note: "123.ie shows month + year (e.g., December 2017). Verify date input behavior."
          }
        ]
      };
    }
    if (field.valueFrom === "vehicle.estimated_value_eur") {
      return {
        ...field,
        targets: [
          {
            label: "Vehicle Value",
            inputType: "text",
            selector: "input[aria-label*=\"car is worth\"]",
            note: "Selector uses aria-label substring; verify on 123.ie Policy details step."
          }
        ]
      };
    }
    if (field.valueFrom === "policy.use") {
      return {
        ...field,
        targets: [
          {
            label: "Use of Vehicle",
            inputType: "radio",
            selector: "text={{value}}",
            optionMap: {
              "Social, domestic & pleasure": "Social, domestic & pleasure",
              "Class 1": "Class 1"
            },
            note: "123.ie uses card choices; selector uses text matching."
          }
        ]
      };
    }
    if (field.valueFrom === "policy.annual_mileage_km") {
      return {
        ...field,
        transform: "number",
        targets: [
          {
            label: "Annual Mileage (km)",
            inputType: "select",
            selector: "input[placeholder=\"Select to the nearest thousand\"]",
            note: "Likely opens a dropdown; may need option selection after typing."
          }
        ]
      };
    }
    if (field.valueFrom === "policy.cover_start_date") {
      return {
        ...field,
        transform: "date_label_long",
        targets: [
          {
            label: "Cover Start Date (open picker)",
            inputType: "click",
            selector: "input[placeholder=\"Select a date\"]",
            note: "Opens the date picker on 123.ie."
          },
          {
            label: "Cover Start Date (select day)",
            inputType: "click",
            selector: "role=button[name=\"{{value}}\"]",
            note: "Selects a date like \"20, April 2026\" in the calendar. May need month navigation."
          }
        ]
      };
    }
    if (field.valueFrom === "licence.type") {
      return {
        ...field,
        targets: [
          {
            label: "Licence Type",
            inputType: "radio",
            selector: "text={{value}}",
            optionMap: {
              "Full Irish": "Full Irish Licence",
              "Full Irish Licence": "Full Irish Licence",
              "Full EU": "Full EU Licence",
              "Full EU Licence": "Full EU Licence",
              "Full UK": "Full UK Licence",
              "Full UK Licence": "Full UK Licence",
              "Provisional Irish": "Provisional Irish Licence",
              "Provisional Irish Licence": "Provisional Irish Licence"
            },
            note: "123.ie uses card choices for licence type."
          }
        ]
      };
    }
    if (field.valueFrom === "licence.years_held") {
      return {
        ...field,
        transform: "number",
        targets: [
          {
            label: "Years Licence Held",
            inputType: "radio",
            selector: "text={{value}}",
            optionMap: {
              "9": "9+",
              "10": "9+",
              "11": "9+",
              "12": "9+",
              "13": "9+",
              "14": "9+",
              "15": "9+"
            },
            note: "123.ie shows 0-8 and 9+ options."
          }
        ]
      };
    }
    if (field.valueFrom === "licence.penalty_points") {
      return {
        ...field,
        transform: "number",
        targets: [
          {
            label: "Penalty Points",
            inputType: "radio",
            selector: "text={{value}}",
            optionMap: {
              "0": "No",
              "1": "Yes",
              "2": "Yes",
              "3": "Yes",
              "4": "Yes",
              "5": "Yes",
              "6": "Yes",
              "7": "Yes",
              "8": "Yes",
              "9": "Yes",
              "10": "Yes"
            },
            note: "123.ie asks if any penalty points in last 3 years."
          }
        ]
      };
    }
    if (field.valueFrom === "licence.convictions") {
      return {
        ...field,
        transform: "bool_yes_no",
        targets: [
          {
            label: "Convictions",
            inputType: "radio",
            selector: "text={{value}}",
            note: "Convictions / pending prosecutions question."
          }
        ]
      };
    }
    if (field.valueFrom === "claims.ncb_years") {
      return {
        ...field,
        transform: "number",
        targets: [
          {
            label: "No Claims Bonus Years",
            inputType: "radio",
            selector: "text={{value}}",
            optionMap: {
              "6": "6+",
              "7": "6+",
              "8": "6+",
              "9": "6+",
              "10": "6+"
            },
            note: "NCB options are 0-5 and 6+."
          }
        ]
      };
    }
    if (field.valueFrom === "claims.claims_last_2_years") {
      return {
        ...field,
        transform: "number",
        targets: [
          {
            label: "Claims In Last 4 Years",
            inputType: "radio",
            selector: "text={{value}}",
            optionMap: {
              "0": "No",
              "1": "Yes",
              "2": "Yes",
              "3": "Yes",
              "4": "Yes",
              "5": "Yes"
            },
            note: "123.ie asks claims in last 4 years; mapping assumes 0 -> No, >0 -> Yes."
          }
        ]
      };
    }
    if (field.valueFrom === "driver.title") {
      return {
        ...field,
        targets: [
          {
            label: "Title",
            inputType: "text",
            selector: "input[placeholder=\"Please select...\"]",
            note: "Title dropdown. May require opening the list and selecting an option."
          },
          {
            label: "Title Option",
            inputType: "click",
            selector: "text={{value}}",
            optionMap: {
              "Mr": "Mr",
              "Mrs": "Mrs",
              "Ms": "Ms",
              "Miss": "Miss"
            },
            note: "Selects title option after opening dropdown."
          }
        ]
      };
    }
    if (field.valueFrom === "driver.first_name") {
      return {
        ...field,
        targets: [
          {
            label: "First name",
            inputType: "text",
            selector: "input[placeholder=\"E.g. Orla\"]"
          }
        ]
      };
    }
    if (field.valueFrom === "driver.last_name") {
      return {
        ...field,
        targets: [
          {
            label: "Last name",
            inputType: "text",
            selector: "input[placeholder=\"E.g. McCarthy\"]"
          }
        ]
      };
    }
    if (field.valueFrom === "driver.date_of_birth") {
      return {
        ...field,
        transform: "date_dmy_slashes",
        targets: [
          {
            label: "Date of birth",
            inputType: "text",
            selector: "input[placeholder=\"DD/MM/YYYY\"]"
          }
        ]
      };
    }
    if (field.valueFrom === "driver.occupation") {
      return {
        ...field,
        targets: [
          {
            label: "Employment Status",
            inputType: "radio",
            selector: "text={{value}}",
            optionMap: {
              "Homemaker": "Homemaker",
              "Employed": "Employed/Self Employed",
              "Self Employed": "Employed/Self Employed",
              "Unemployed": "Unemployed",
              "Retired": "Retired",
              "Student": "Student"
            },
            note: "123.ie uses employment status cards."
          }
        ]
      };
    }
    if (field.valueFrom === "contact.eircode") {
      return {
        ...field,
        targets: [
          {
            label: "Address Lookup",
            inputType: "text",
            selector: "input[placeholder=\"Start typing an Eircode or address\"]",
            note: "123.ie address autocomplete prefers Eircode; user may need to select a suggestion."
          },
          {
            label: "Address Suggestion",
            inputType: "click",
            selector: "text={{value}}",
            optionMap: {
              "A84A726": "44 CHURCHFIELD PARK, ASHBOURNE, MEATH, A84A726"
            },
            note: "Selects the address suggestion by visible text."
          }
        ]
      };
    }
    if (field.valueFrom === "contact.phone") {
      return {
        ...field,
        targets: [
          {
            label: "Phone number",
            inputType: "text",
            selector: "input[placeholder=\"E.g. 086 123 4567\"]"
          }
        ]
      };
    }
    if (field.valueFrom === "contact.email") {
      return {
        ...field,
        targets: [
          {
            label: "Email address",
            inputType: "text",
            selector: "input[placeholder=\"E.g. orla@123.ie\"]"
          }
        ]
      };
    }
    if (field.valueFrom === "driver.additional_drivers") {
      return {
        ...field,
        transform: "bool_yes_no",
        targets: [
          {
            label: "Additional Drivers",
            inputType: "radio",
            selector: "text={{value}}",
            note: "123.ie additional driver question (Yes/No)."
          }
        ]
      };
    }
    return field;
  }),
  redclick: baseFields,
  zurich: baseFields,
  aviva: baseFields,
  aa: baseFields,
  chill: baseFields,
  supervalu: baseFields,
  anpost: baseFields,
  allianz: baseFields
};

export const insurerKeys: InsurerKey[] = Object.keys(insurerFieldMaps) as InsurerKey[];
