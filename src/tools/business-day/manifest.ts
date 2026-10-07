import type { ToolManifest } from "../../catalog/manifest";

export const businessDayManifest = {
  id: "business-day",
  route: "/tools/business-day",
  name: "Business Day Calculator",
  summary: "Add or count working days using an explicit workweek and optional excluded dates.",
  aliases: ["working day calculator", "workday calculator"],
  jobs: ["add business days", "count working days", "calculate workdays"],
  category: "date-time",
  inputTypes: ["date", "number"],
  implementation: "../tools/business-day/module.ts",
  engine: "date-time",
  runtime: {
    location: "LOCAL",
    network: "forbidden",
  },
  profileFields: [
    {
      key: "workweek",
      defaultValue: ["MON", "TUE", "WED", "THU", "FRI"],
    },
    { key: "locale" },
  ],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-083",
    fixtureFamilies: ["business-days"],
  },
} as const satisfies ToolManifest;

export default businessDayManifest;
