import type { ToolManifest } from "../../catalog/manifest";

export const utmParserManifest = {
  id: "utm-parser",
  route: "/tools/utm-parser",
  name: "UTM Parser",
  summary: "Read campaign fields and repeated UTM parameters from a URL without changing its order or encoding.",
  aliases: ["utm query reader", "campaign parameter parser"],
  jobs: ["inspect campaign query parameters", "read utm fields from a link"],
  category: "marketing",
  inputTypes: ["url"],
  implementation: "../tools/utm-parser/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-062", fixtureFamilies: ["utm-roundtrip", "query-params"] },
} as const satisfies ToolManifest;

export default utmParserManifest;
