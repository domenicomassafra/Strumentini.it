import type { ToolManifest } from "../../catalog/manifest";

export const pdfSplitManifest = {
  id: "pdf-split",
  route: "/tools/pdf-split",
  name: "PDF Split",
  summary: "Split a local PDF into explicit page-range files with bounded memory and page checks.",
  aliases: ["split pdf", "split pdf pages", "pdf page splitter"],
  jobs: ["split a pdf", "extract pdf sections", "split pdf by pages"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-split/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-122", fixtureFamilies: ["pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfSplitManifest;
