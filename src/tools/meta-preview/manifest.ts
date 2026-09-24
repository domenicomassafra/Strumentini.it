import type { ToolManifest } from "../../catalog/manifest";

export const metaPreviewManifest = {
  id: "meta-preview",
  route: "/tools/meta-preview",
  name: "Meta Title / Description Preview",
  summary: "Measure title and description lengths and produce escaped preview text without rendering active content.",
  aliases: ["seo title checker", "meta description preview"],
  jobs: ["check seo title length", "preview title and description limits"],
  category: "marketing",
  inputTypes: ["text"],
  implementation: "../tools/meta-preview/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-070", fixtureFamilies: ["html-entities", "url-security"] },
} as const satisfies ToolManifest;

export default metaPreviewManifest;
