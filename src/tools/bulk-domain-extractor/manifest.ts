import type { ToolManifest } from "../../catalog/manifest";

export const bulkDomainExtractorManifest = {
  id: "bulk-domain-extractor",
  route: "/tools/bulk-domain-extractor",
  name: "Bulk Domain Extractor",
  summary: "Extract unique lowercase domains from pasted URLs or domain tokens while reporting invalid tokens.",
  aliases: ["extract domains from list", "domain list cleaner"],
  jobs: ["extract domains from a list", "collect unique site hosts"],
  category: "web-operations",
  inputTypes: ["lines", "url"],
  implementation: "../tools/bulk-domain-extractor/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-075", fixtureFamilies: ["url-security", "query-params"] },
} as const satisfies ToolManifest;

export default bulkDomainExtractorManifest;
