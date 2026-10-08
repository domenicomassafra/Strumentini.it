import type { ToolManifest } from "../../catalog/manifest";

export const printablePdfFromTextManifest = {
  id: "printable-pdf-from-text",
  route: "/tools/printable-pdf-from-text",
  name: "TXT, Markdown, HTML, CSV in PDF stampabile",
  summary: "Impagina testo e CSV in PDF locali A4/Letter con a capo, pagine numerate, margini e anteprima PDF.js.",
  aliases: ["testo pdf", "markdown pdf", "html pdf", "csv pdf", "printable document"],
  jobs: ["create local printable pdf from text", "convert markdown to print pdf", "paginate csv table into pdf"],
  category: "documents",
  inputTypes: ["text/plain", "text/markdown", "text/html", "text/csv"],
  capabilities: ["file-read", "file-write"],
  implementation: "../tools/printable-pdf-from-text/module.ts",
  engine: "pdf",
  runtime: { location: "LOCAL", network: "forbidden" },
  profileFields: [],
  result: { class: "pdf", capabilities: ["download", "reset", "retry"] },
  handoff: { emits: [{ type: "file", format: "pdf" }] },
  gold: { maintenanceClass: "H", oracleEntryId: "cand-256", fixtureFamilies: ["printable-text-pdf"] },
} as const satisfies ToolManifest;

export default printablePdfFromTextManifest;
