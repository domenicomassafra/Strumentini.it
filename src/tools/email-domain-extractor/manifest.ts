import type { ToolManifest } from "../../catalog/manifest";

export const emailDomainExtractorManifest = {
  id: "email-domain-extractor",
  route: "/tools/email-domain-extractor",
  name: "Email-Domain Extractor",
  summary: "Extract unique email addresses and domains from pasted text with unmatched-token visibility.",
  aliases: ["email domain list", "extract email hosts"],
  jobs: ["extract email domains", "deduplicate pasted email addresses"],
  category: "web-operations",
  inputTypes: ["lines", "text"],
  implementation: "../tools/email-domain-extractor/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "E", oracleEntryId: "cand-077", fixtureFamilies: ["url-security", "query-params"] },
} as const satisfies ToolManifest;

export default emailDomainExtractorManifest;
