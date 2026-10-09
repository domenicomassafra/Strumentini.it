import type { ToolManifest } from "../../catalog/manifest";

export const pdfBookletInterleaveManifest = {
  id: "pdf-booklet-interleave",
  route: "/tools/pdf-booklet-interleave",
  name: "PDF booklet e intercala fronte/retro",
  summary: "Componi un booklet pieghevole o intercala pagine fronte e retro con ordine di stampa e padding bianchi dichiarati.",
  aliases: ["booklet pdf", "opuscolo pdf", "interleave pdf", "duplex scanner", "intercala fronte retro pdf"],
  jobs: ["imporre PDF in booklet pieghevole", "intercalare scansioni fronte e retro", "prevedere fogli bianchi per stampa duplex"],
  category: "documents",
  inputTypes: ["application/pdf"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/pdf-booklet-interleave/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "pdf", capabilities: ["download", "reset", "retry"] },
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-267", fixtureFamilies: ["pdf-gold", "pdf-signature"] },
} as const satisfies ToolManifest;

export default pdfBookletInterleaveManifest;
