import type { ToolManifest } from "../../catalog/manifest";

export const textMarkupConverterManifest = {
  id: "text-markup-converter",
  route: "/tools/text-markup-converter",
  name: "TXT Markdown HTML Converter",
  summary: "Convert locally among Markdown, HTML and plain text through one normalized document model with explicit structure-loss reporting and a sanitized preview.",
  aliases: ["markdown to html converter", "html to markdown converter", "markdown to text converter", "html to text converter", "text to html converter"],
  jobs: ["convert markdown to html", "convert html to markdown", "convert markdown to plain text", "convert plain text to html", "convert html to plain text"],
  category: "text",
  inputTypes: ["text", "markdown", "html"],
  implementation: "../tools/text-markup-converter/module.ts",
  engine: "text-markup-conversion",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-241", fixtureFamilies: ["text-markup-conversion"] },
} as const satisfies ToolManifest;

export default textMarkupConverterManifest;
