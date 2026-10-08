import type { ToolManifest } from "../../catalog/manifest";

export const pdfNUpManifest = {
  id: "pdf-n-up",
  route: "/tools/pdf-n-up",
  name: "PDF N-up: più pagine per foglio",
  summary: "Impagina 2, 4 o fino a 8 pagine PDF per foglio A4, Letter o personalizzato, con ordine e celle vuote verificabili. Output rasterizzato dichiarato.",
  aliases: ["pdf n up", "pdf 2 pagine per foglio", "pdf 4 pagine per foglio", "stampare più pagine per foglio"],
  jobs: ["impaginare PDF due per foglio", "creare PDF quattro per foglio", "creare fogli PDF personalizzati per stampa"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-n-up/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "pdf", capabilities: ["download", "reset", "retry"] },
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-265", fixtureFamilies: ["pdf-gold", "pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfNUpManifest;
