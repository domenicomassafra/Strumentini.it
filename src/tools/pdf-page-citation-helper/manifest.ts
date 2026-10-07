import type { ToolManifest } from "../../catalog/manifest";
import { researchResultV2Declaration } from "../research-result-v2";

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
  result: researchResultV2Declaration("pdf-page-citation-helper"),
  gold: { maintenanceClass: "E", oracleEntryId: "cand-190", fixtureFamilies: ["research-citation-pages"] },
} as const satisfies ToolManifest;

export default pdfPageCitationHelperManifest;
