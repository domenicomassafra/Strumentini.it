import type { ToolManifest } from "../../catalog/manifest";

export const findReplacePreviewManifest = {
  id: "find-replace-preview",
  route: "/tools/find-replace-preview",
  name: "Find & Replace Preview",
  summary: "Preview literal or regular-expression replacements and inspect every match before copying output.",
  aliases: ["find and replace", "replace preview", "regex replace preview"],
  jobs: ["preview find replace", "replace text safely", "test regular expression replacement"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/find-replace-preview/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-012", fixtureFamilies: ["word-character-line-count"] },
} as const satisfies ToolManifest;

export default findReplacePreviewManifest;
