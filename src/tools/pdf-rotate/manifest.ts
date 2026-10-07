import type { ToolManifest } from "../../catalog/manifest";
import { PDF_RESULT_DECLARATIONS } from "../pdf-result-declarations";

export const pdfRotateManifest = {
  id: "pdf-rotate",
  route: "/tools/pdf-rotate",
  name: "PDF Rotate",
  summary: "Rotate selected pages by explicit 90, 180, or 270 degree steps locally.",
  aliases: ["rotate pdf", "turn pdf pages", "pdf page rotation"],
  jobs: ["rotate pdf pages", "turn a pdf page", "set pdf page rotation"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-rotate/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: PDF_RESULT_DECLARATIONS["pdf-rotate"],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-124", fixtureFamilies: ["pdf-signature", "pdf-gold"] },
} as const satisfies ToolManifest;

export default pdfRotateManifest;
