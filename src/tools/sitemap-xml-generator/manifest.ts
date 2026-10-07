import type { ToolManifest } from "../../catalog/manifest";

export const sitemapXmlGeneratorManifest = {
  id: "sitemap-xml-generator",
  route: "/tools/sitemap-xml-generator",
  name: "Sitemap XML Generator",
  summary: "Generate a local sitemap.xml from validated HTTP(S) URLs with optional lastmod, changefreq and priority metadata only when supplied.",
  aliases: ["sitemap generator", "sitemap xml builder", "crea sitemap xml"],
  jobs: ["generate sitemap xml", "build sitemap from url list", "create sitemap file"],
  category: "web-operations",
  inputTypes: ["lines", "url", "text"],
  capabilities: ["clipboard"],
  implementation: "../tools/sitemap-xml-generator/module.ts",
  engine: "url-marketing",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { accepts: [{ type: "lines", format: "tsv", maxBytes: 52428800 }], emits: [{ type: "file", format: "application/xml", maxBytes: 52428800 }] },
  result: { class: "text-code", capabilities: ["copy", "download", "reset", "provenance"] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-245", fixtureFamilies: ["sitemap-xml"] },
} as const satisfies ToolManifest;

export default sitemapXmlGeneratorManifest;
