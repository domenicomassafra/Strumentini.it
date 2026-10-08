import type { ToolManifest } from "../../catalog/manifest";

export const pdfWatermarkManifest = {
  id: "pdf-watermark",
  route: "/tools/pdf-watermark",
  name: "PDF Watermark Overlay",
  summary: "Add a visible translucent text watermark to chosen PDF pages, with opacity, rotation, scale and a real-page preview. Not redaction.",
  aliases: ["watermark pdf", "pdf overlay watermark", "filigrana pdf"],
  jobs: ["overlay watermark text on pdf pages", "mark pdf as draft or copy", "rotate a visible pdf watermark"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-watermark/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "pdf", capabilities: ["download", "reset", "retry"] },
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-262", fixtureFamilies: ["pdf-gold", "pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfWatermarkManifest;
