import type { ToolManifest } from "../../catalog/manifest";
import { TEXT_RESULT_V2_DECLARATIONS } from "../text-writing/result-v2";

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
  result: TEXT_RESULT_V2_DECLARATIONS["slug-generator"],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-016", fixtureFamilies: ["word-character-line-count", "text-writing-gold"] },
} as const satisfies ToolManifest;

export default slugGeneratorManifest;
