import type { ToolManifest } from "../../catalog/manifest";

export const openGraphPreviewManifest = {
  id: "open-graph-preview",
  route: "/tools/open-graph-preview",
  name: "Open Graph Preview",
  summary: "Extract Open Graph and Twitter card tags from pasted HTML locally without fetching or executing it.",
  aliases: ["og tag preview", "social card metadata inspector"],
  jobs: ["inspect open graph tags", "extract social card metadata"],
  category: "marketing",
  inputTypes: ["text", "structured"],
  implementation: "../tools/open-graph-preview/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-071", fixtureFamilies: ["url-security", "html-entities"] },
} as const satisfies ToolManifest;

export default openGraphPreviewManifest;
