import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfMetadataRemoverManifest = {
  id: "pdf-metadata-remover",
  route: "/tools/pdf-metadata-remover",
  name: "PDF Metadata Remover",
  summary: "Remove addressed Info/XMP metadata locally, reparse the output, and verify page count plus bounded text baseline before success.",
  aliases: ["remove pdf metadata", "strip pdf properties", "pdf privacy scrub"],
  jobs: ["remove pdf metadata", "strip pdf info fields", "scrub pdf document properties"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-metadata-remover/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-metadata-remover"],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "E", oracleEntryId: "cand-130", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfMetadataRemoverManifest;
