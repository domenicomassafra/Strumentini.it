import type { ToolManifest } from "../../catalog/manifest";

export const caseConverterManifest = {
  id: "case-converter",
  route: "/tools/case-converter",
  name: "Case Converter",
  summary: "Convert text to sentence, title, camel, pascal, kebab, snake, or constant case locally.",
  aliases: ["uppercase converter", "lowercase converter", "title case", "camel case"],
  jobs: ["change text case", "convert identifiers", "format headings"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/case-converter/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-003", fixtureFamilies: ["unicode-normalization", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default caseConverterManifest;
