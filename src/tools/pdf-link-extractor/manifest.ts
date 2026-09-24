import type { ToolManifest } from "../../catalog/manifest";

export const pdfLinkExtractorManifest = {
  id: "pdf-link-extractor",
  route: "/tools/pdf-link-extractor",
  name: "PDF Link Extractor",
  summary: "List URI links found in local PDF annotation and action dictionaries without opening them.",
  aliases: ["extract pdf links", "list pdf urls", "pdf hyperlink inspector"],
  jobs: ["extract links from pdf", "list pdf hyperlinks", "inspect pdf uri annotations"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read"],
  implementation: "../tools/pdf-link-extractor/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "structured", format: "pdf-links" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-136", fixtureFamilies: ["pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfLinkExtractorManifest;
