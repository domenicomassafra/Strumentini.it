import type { ToolManifest } from "../../catalog/manifest";

export const slugGeneratorManifest = {
  id: "slug-generator",
  route: "/tools/slug-generator",
  name: "Slug Generator",
  summary: "Create readable Unicode-aware slugs with configurable separators, case, and length.",
  aliases: ["url slug generator", "make a slug", "seo slug"],
  jobs: ["generate a slug", "create a url-safe identifier", "clean a title for a url"],
  category: "text",
  inputTypes: ["text", "writing"],
  implementation: "../tools/slug-generator/module.ts",
  engine: "text-writing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-016", fixtureFamilies: ["word-character-line-count"] },
} as const satisfies ToolManifest;

export default slugGeneratorManifest;
