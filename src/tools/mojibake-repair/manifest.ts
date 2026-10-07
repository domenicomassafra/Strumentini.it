import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

export const mojibakeRepairManifest = {
  id: "mojibake-repair",
  route: "/tools/mojibake-repair",
  name: "Mojibake Repair with Disclosed Transforms",
  summary: "Preview conservative UTF-8/Windows-1252 mojibake repair and refuse ambiguous conversions while preserving the original text.",
  aliases: ["mojibake repair", "fix garbled utf8", "windows 1252 utf8 repair"],
  jobs: ["repair common mojibake text", "inspect encoding repair transform"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/mojibake-repair/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: TEXT_RESULT_V2_DECLARATIONS["mojibake-repair"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-235", fixtureFamilies: ["text-expansion"] },
} as const satisfies ToolManifest;

export default mojibakeRepairManifest;
