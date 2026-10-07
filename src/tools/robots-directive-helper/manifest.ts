import type { ToolManifest } from "../../catalog/manifest";

export const robotsDirectiveHelperManifest = {
  id: "robots-directive-helper",
  route: "/tools/robots-directive-helper",
  name: "Robots Directive Helper",
  summary: "Parse robots.txt groups, allow/disallow paths, sitemaps, and malformed lines into a reviewable local result.",
  aliases: ["robots txt parser", "robots directive inspector"],
  jobs: ["parse robots.txt", "review crawler directives"],
  category: "web-operations",
  inputTypes: ["text"],
  implementation: "../tools/robots-directive-helper/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-072", fixtureFamilies: ["robots", "url-security"] },
} as const satisfies ToolManifest;

export default robotsDirectiveHelperManifest;
