import type { ToolManifest } from "../../catalog/manifest";

export const pdfFillOverlaysManifest = {
  id: "pdf-fill-overlays",
  route: "/tools/pdf-fill-overlays",
  name: "Scrivi, evidenzia e compila PDF (appiattito)",
  summary: "Aggiungi testo visibile, evidenzia e compila campi PDF /Tx semplici, sempre con output non modificabile e verificato.",
  aliases: ["compilare pdf testo", "scrivere sul pdf", "annotare pdf", "evidenziare pdf", "pdf overlay"],
  jobs: ["inserire testo visibile su una pagina PDF", "evidenziare una zona del PDF", "appiattire compilazione PDF testuale"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-fill-overlays/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "pdf", capabilities: ["download", "reset", "retry"] },
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-269", fixtureFamilies: ["pdf-gold", "pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfFillOverlaysManifest;
