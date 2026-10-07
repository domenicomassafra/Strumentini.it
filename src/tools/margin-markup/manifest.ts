import type { ToolManifest } from "../../catalog/manifest";

export const marginMarkupManifest = {
  id: "margin-markup",
  route: "/tools/margin-markup",
  name: "Margin / Markup Calculator",
  summary: "Compare margin and markup from price and cost with the formulas and denominator rules shown.",
  aliases: ["margin calculator", "markup calculator", "profit margin calculator"],
  jobs: ["calculate margin", "calculate markup", "compare margin and markup"],
  category: "client-work-math",
  inputTypes: ["decimal", "money"],
  implementation: "../tools/margin-markup/module.ts",
  engine: "client-time-math",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [{ key: "currency" }],
  result: { class: "calculator", capabilities: ["copy", "reset", "provenance"] },
  gold: {
    maintenanceClass: "E",
    oracleEntryId: "cand-108",
    fixtureFamilies: ["business-math"],
  },
} as const satisfies ToolManifest;

export default marginMarkupManifest;
