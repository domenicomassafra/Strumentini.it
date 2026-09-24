import type { ToolManifest } from "../../catalog/manifest";

export const urlBulkNormalizerManifest = {
  id: "url-bulk-normalizer",
  route: "/tools/url-bulk-normalizer",
  name: "URL Bulk Normalizer",
  summary: "Normalize a pasted list of HTTP(S) URLs with stable, per-row errors and explicit query policy.",
  aliases: ["normalize urls in bulk", "batch url canonicalizer"],
  jobs: ["normalize a url list", "canonicalize pasted links"],
  category: "web-operations",
  inputTypes: ["lines", "url"],
  implementation: "../tools/url-bulk-normalizer/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-065", fixtureFamilies: ["query-params", "url-security"] },
} as const satisfies ToolManifest;

export default urlBulkNormalizerManifest;
