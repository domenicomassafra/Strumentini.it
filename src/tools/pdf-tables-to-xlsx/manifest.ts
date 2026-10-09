import type { ToolManifest } from "../../catalog/manifest";

export const pdfTablesToXlsxManifest = {
  id: "pdf-tables-to-xlsx",
  route: "/tools/pdf-tables-to-xlsx",
  name: "Tabelle PDF in Excel (XLSX)",
  summary: "Esporta una griglia PDF delimitata da linee reali in XLSX, con anteprima e origine verificabili. Rifiuta OCR e tabelle ambigue.",
  aliases: ["pdf tabella excel", "pdf tables xlsx", "convertire griglia pdf", "tabella pdf in foglio excel"],
  jobs: ["esportare griglia PDF tracciata in Excel", "verificare celle PDF prima di scaricare XLSX"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-tables-to-xlsx/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "file", capabilities: ["download", "reset", "retry"] },
  handoff: { emits: [{ type: "file", format: "xlsx" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-268", fixtureFamilies: ["pdf-gold", "pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfTablesToXlsxManifest;
