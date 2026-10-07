import type { ToolManifest } from "../../catalog/manifest";

export const domainSubdomainGrouperManifest = {
  id: "domain-subdomain-grouper",
  route: "/tools/domain-subdomain-grouper",
  name: "Domain / Subdomain Grouper",
  summary: "Group hostnames by a deterministic registrable-domain heuristic and retain their observed subdomains.",
  aliases: ["group domains by root", "subdomain inventory"],
  jobs: ["group hosts by root domain", "inventory subdomains"],
  category: "web-operations",
  inputTypes: ["lines", "url"],
  implementation: "../tools/domain-subdomain-grouper/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-076", fixtureFamilies: ["url-security", "query-params"] },
} as const satisfies ToolManifest;

export default domainSubdomainGrouperManifest;
