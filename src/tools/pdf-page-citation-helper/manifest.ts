import type { ToolManifest } from "../../catalog/manifest";

export const pdfPageCitationHelperManifest = {
  id: "pdf-page-citation-helper",
  route: "/tools/pdf-page-citation-helper",
  name: "PDF Page Citation Helper",
  summary: "Format a page or page-range citation from supplied bibliographic fields without parsing a PDF.",
  aliases: ["pdf page citation", "page range citation"],
  jobs: ["format a pdf page citation", "cite pdf pages", "format a page range"],
  category: "research",
  inputTypes: ["text", "number"],
  implementation: "../tools/pdf-page-citation-helper/module.ts",
  engine: "research-knowledge",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  gold: { maintenanceClass: "D", oracleEntryId: "cand-190", fixtureFamilies: ["pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfPageCitationHelperManifest;
