import type { ToolManifest } from "../../catalog/manifest";

export const canonicalUrlHelperManifest = {
  id: "canonical-url-helper",
  route: "/tools/canonical-url-helper",
  name: "Canonical URL Helper",
  summary: "Resolve a relative canonical target against a page URL and produce a safely escaped link tag.",
  aliases: ["canonical link builder", "canonical url tag generator"],
  jobs: ["create a canonical link tag", "resolve a canonical target"],
  category: "web-operations",
  inputTypes: ["url", "text"],
  implementation: "../tools/canonical-url-helper/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-073", fixtureFamilies: ["url-security", "query-params"] },
} as const satisfies ToolManifest;

export default canonicalUrlHelperManifest;
